"""TRAE Forum Posts Fetcher - 异步并发版

从 TRAE 官方中文社区抓取用户帖子，支持：
- 异步并发抓取，大幅提升速度
- 增量更新，仅对新增或数据变化的帖子刷新详情
- 未变化帖子复用已有详情，减少 API 调用
- 结构化日志输出
- Pydantic 数据校验
- 进度条显示
- 抓取失败保护：首页获取失败时中止运行，避免空数据覆盖已有 posts.json
- 已删除帖子检测：完整抓取时两段式确认（标记→复核）并清理已删除帖子
"""

import asyncio
import json
import logging
import os
import sys
import time
from html import unescape
from pathlib import Path
from typing import Optional

import aiohttp
from pydantic import BaseModel, Field
from tqdm import tqdm

# ──────────────────────────────────────────────
# 常量
# ──────────────────────────────────────────────
FORUM_BASE = "https://forum.trae.cn"
REQUEST_DELAY = 1.0  # 异步模式下可以缩短
MAX_RETRIES = 3
MAX_EXCERPT_LEN = 200
MAX_PAGES = 200
CONCURRENCY = 5  # 并发数

PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_PATH = PROJECT_ROOT / "config.json"
OUTPUT_PATH = PROJECT_ROOT / "data" / "posts.json"

# ──────────────────────────────────────────────
# 日志配置
# ──────────────────────────────────────────────
def setup_logging() -> logging.Logger:
    logger = logging.getLogger("trae-fetcher")
    logger.setLevel(logging.DEBUG)

    # 控制台 handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(console)

    # 文件 handler（可选）
    log_dir = PROJECT_ROOT / "logs"
    log_dir.mkdir(exist_ok=True)
    file_handler = logging.FileHandler(
        log_dir / "fetch.log", encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
    ))
    logger.addHandler(file_handler)

    return logger

log = setup_logging()

# ──────────────────────────────────────────────
# Pydantic 数据模型
# ──────────────────────────────────────────────
class CategoryConfig(BaseModel):
    color: str = "#9BA3B5"
    soft: str = "#EDF0F7"
    icon: str = "📁"
    visible: bool = True

class AppConfig(BaseModel):
    categories: dict[str, CategoryConfig] = Field(default_factory=dict)

class UserProfile(BaseModel):
    id: Optional[int] = None
    username: str
    name: str = ""
    avatar_url: str = ""
    title: str = ""
    website: str = ""
    trust_level: int = 0
    created_at: str = ""

class PostItem(BaseModel):
    id: int
    title: str
    created_at: str
    last_posted_at: str = ""
    category_id: int = 0
    category_name: str = ""
    tags: list[str] = Field(default_factory=list)
    excerpt: str = ""
    image_url: str = ""
    views: int = 0
    like_count: int = 0
    reply_count: int = 0
    posts_count: int = 0
    url: str = ""
    pinned: bool = False
    closed: bool = False
    archived: bool = False

class OutputData(BaseModel):
    model_config = {"populate_by_name": True}

    updated_at: str
    user: UserProfile
    total_posts: int
    excluded_posts: int
    categories: dict[str, int]
    posts: list[PostItem]
    quality: dict = Field(default_factory=dict, alias="_quality")

# ──────────────────────────────────────────────
# 配置加载
# ──────────────────────────────────────────────
def load_config() -> AppConfig:
    if not CONFIG_PATH.exists():
        log.warning("配置文件 %s 不存在，使用默认配置", CONFIG_PATH)
        return AppConfig()
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            raw = json.load(f)
        config = AppConfig(**raw)
        for name, cfg in config.categories.items():
            if not cfg.color.startswith("#"):
                log.warning("分类 '%s' 颜色格式无效: %s", name, cfg.color)
        return config
    except Exception as e:
        log.error("加载配置失败: %s", e)
        return AppConfig()

# ──────────────────────────────────────────────
# 异步 HTTP 客户端
# ──────────────────────────────────────────────
class ForumClient:
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.semaphore = asyncio.Semaphore(CONCURRENCY)

    async def fetch_json(self, url: str, retries: int = MAX_RETRIES) -> Optional[dict]:
        for attempt in range(retries):
            try:
                async with self.semaphore:
                    async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                        if resp.status >= 500:
                            log.warning("HTTP %d (尝试 %d/%d): %s", resp.status, attempt+1, retries, url)
                            await asyncio.sleep(REQUEST_DELAY * (2 ** attempt))
                            continue
                        if resp.status >= 400:
                            log.warning("HTTP %d，跳过: %s", resp.status, url)
                            return None
                        data = await resp.json()
                        if not isinstance(data, dict):
                            log.warning("响应格式异常 (尝试 %d/%d): %s", attempt+1, retries, url)
                            await asyncio.sleep(REQUEST_DELAY * (2 ** attempt))
                            continue
                        return data
            except asyncio.TimeoutError:
                log.warning("请求超时 (尝试 %d/%d): %s", attempt+1, retries, url)
                await asyncio.sleep(REQUEST_DELAY * (2 ** attempt))
            except aiohttp.ClientError as e:
                log.warning("连接失败 (尝试 %d/%d): %s - %s", attempt+1, retries, url, e)
                await asyncio.sleep(REQUEST_DELAY * (2 ** attempt))
            except Exception as e:
                log.error("请求异常 (尝试 %d/%d): %s - %s", attempt+1, retries, url, e)
                await asyncio.sleep(REQUEST_DELAY * (2 ** attempt))
        return None

# ──────────────────────────────────────────────
# 论坛数据获取
# ──────────────────────────────────────────────
async def fetch_category_map(client: ForumClient) -> tuple[dict[int, str], dict[int, int]]:
    data = await client.fetch_json(f"{FORUM_BASE}/site.json")
    if not data:
        log.error("无法获取分类列表")
        return {}, {}

    cat_map: dict[int, str] = {}
    sub_cat_map: dict[int, int] = {}

    for cat in data.get("categories", []):
        cat_id = cat.get("id")
        name = cat.get("name", "")
        parent_id = cat.get("parent_category_id")
        if cat_id and name:
            if parent_id:
                sub_cat_map[cat_id] = parent_id
            else:
                cat_map[cat_id] = name

    log.info("顶层大类: %d 个, 子分类: %d 个", len(cat_map), len(sub_cat_map))
    return cat_map, sub_cat_map

async def fetch_user_profile(client: ForumClient, username: str) -> Optional[UserProfile]:
    data = await client.fetch_json(f"{FORUM_BASE}/u/{username}.json")
    if not data or not data.get("user"):
        return None

    user = data["user"]
    avatar_template = user.get("avatar_url", "") or user.get("avatar_template", "")
    avatar_url = ""

    if avatar_template:
        if avatar_template.startswith("//"):
            avatar_url = "https:" + avatar_template.replace("{size}", "120")
        elif avatar_template.startswith("http"):
            avatar_url = avatar_template.replace("{size}", "120")
        else:
            avatar_url = FORUM_BASE + avatar_template.replace("{size}", "120")

    return UserProfile(
        id=user.get("id"),
        username=user.get("username", username),
        name=user.get("name", ""),
        avatar_url=avatar_url,
        title=user.get("title", ""),
        website=user.get("website", ""),
        trust_level=user.get("trust_level", 0),
        created_at=user.get("created_at", ""),
    )

async def fetch_user_topics(client: ForumClient, username: str) -> tuple[list[dict], bool, bool]:
    """抓取用户帖子列表。

    返回 (topics, first_page_failed, complete)：
    - first_page_failed=True 表示首页请求失败或响应格式异常，结果不可信，
      调用方应中止流程，避免用空数据覆盖已有的 posts.json。
    - complete=True 表示分页自然结束（空页或无更多数据），帖子列表完整可信，
      可用于已删除帖子检测；中途出错或达到 MAX_PAGES 时为 False。
    - 首页正常但列表为空视为用户确实无帖子，属于正常结果。
    """
    all_topics: list[dict] = []
    seen_ids: set[int] = set()
    page = 0
    complete = False

    log.info("开始抓取用户 '%s' 的帖子...", username)

    while page < MAX_PAGES:
        url = f"{FORUM_BASE}/topics/created-by/{username}.json"
        if page > 0:
            url += f"?page={page}"

        data = await client.fetch_json(url)
        if data is None:
            if page == 0:
                log.error("首页请求失败（已重试 %d 次），无法区分'无帖子'与'抓取失败'", MAX_RETRIES)
                return [], True, False
            log.warning("获取第 %d 页失败，停止翻页", page + 1)
            break

        topic_list = data.get("topic_list")
        if not isinstance(topic_list, dict):
            if page == 0:
                log.error("首页响应格式异常（缺少 topic_list），结果不可信，中止以保护已有数据")
                return [], True, False
            log.warning("第 %d 页数据格式异常，停止翻页", page + 1)
            break

        topics = topic_list.get("topics", [])
        if not topics:
            log.info("第 %d 页无数据，停止翻页", page + 1)
            complete = True  # 翻到空页，列表已完整
            break

        new_count = 0
        for t in topics:
            tid = t.get("id")
            if tid and tid not in seen_ids:
                seen_ids.add(tid)
                all_topics.append(t)
                new_count += 1

        log.info("第 %d 页: %d 条新帖子", page + 1, new_count)

        if new_count == 0:
            log.info("本页无新数据，停止翻页")
            break

        more_url = topic_list.get("more_topics_url", "")
        if not more_url:
            complete = True  # 服务端确认无更多数据，列表已完整
            break

        page += 1
        await asyncio.sleep(REQUEST_DELAY)

    if page >= MAX_PAGES:
        log.warning("达到最大翻页数 %d，数据可能不完整", MAX_PAGES)

    return all_topics, False, complete

# ──────────────────────────────────────────────
# 数据处理
# ──────────────────────────────────────────────
def resolve_category_id(cat_id: int, cat_map: dict, sub_cat_map: dict) -> tuple[int, str]:
    resolved_id = cat_id
    visited: set[int] = set()
    depth = 0
    max_depth = 10

    while resolved_id in sub_cat_map and resolved_id not in visited and depth < max_depth:
        visited.add(resolved_id)
        resolved_id = sub_cat_map[resolved_id]
        depth += 1

    if depth >= max_depth:
        log.warning("分类ID %d 递归深度超限", cat_id)

    return resolved_id, cat_map.get(resolved_id, f"未知分类({resolved_id})")

def get_excluded_ids(config: AppConfig, cat_map: dict, sub_cat_map: dict) -> set[int]:
    excluded: set[int] = set()
    for cat_id, cat_name in cat_map.items():
        cat_cfg = config.categories.get(cat_name)
        if cat_cfg and not cat_cfg.visible:
            excluded.add(cat_id)
    for sub_id, parent_id in sub_cat_map.items():
        if parent_id in excluded:
            excluded.add(sub_id)
    return excluded

def resolve_image_url(image_url: str) -> str:
    if not image_url:
        return ""
    if image_url.startswith("http"):
        return image_url
    if image_url.startswith("//"):
        return "https:" + image_url
    if image_url.startswith("/"):
        return FORUM_BASE + image_url
    return FORUM_BASE + "/" + image_url

def normalize_tags(raw_tags) -> list[str]:
    """将论坛返回的 tags（字符串或字典混合列表）规范化为字符串列表。"""
    tags: list[str] = []
    for t in raw_tags or []:
        if isinstance(t, dict):
            tag_name = t.get("name", "")
            if tag_name:
                tags.append(tag_name)
        elif isinstance(t, str) and t:
            tags.append(t)
    return tags

def truncate_excerpt(excerpt: str, max_len: int = MAX_EXCERPT_LEN) -> str:
    if not excerpt:
        return ""
    excerpt = unescape(excerpt)
    if len(excerpt) <= max_len:
        return excerpt
    return excerpt[:max_len - 3].rstrip() + "..."

def process_topic(topic: dict, cat_map: dict, sub_cat_map: dict) -> PostItem:
    raw_cat_id = topic.get("category_id", 0)
    cat_id, cat_name = resolve_category_id(raw_cat_id, cat_map, sub_cat_map)

    tags = normalize_tags(topic.get("tags", []))

    return PostItem(
        id=topic.get("id", 0),
        title=topic.get("title", ""),
        created_at=topic.get("created_at", ""),
        last_posted_at=topic.get("last_posted_at", ""),
        category_id=cat_id,
        category_name=cat_name,
        tags=tags,
        excerpt=truncate_excerpt(topic.get("excerpt", "")),
        image_url=resolve_image_url(topic.get("image_url", "")),
        views=topic.get("views", 0) or 0,
        like_count=topic.get("like_count", 0) or 0,
        reply_count=topic.get("reply_count", 0) or 0,
        posts_count=topic.get("posts_count", 0) or 0,
        url=f"{FORUM_BASE}/t/topic/{topic.get('id')}",
        pinned=topic.get("pinned", False),
        closed=topic.get("closed", False),
        archived=topic.get("archived", False),
    )

def process_and_filter_topics(
    raw_topics: list[dict],
    cat_map: dict,
    sub_cat_map: dict,
    excluded_ids: set[int],
) -> tuple[list[PostItem], int]:
    filtered: list[PostItem] = []
    excluded_count = 0
    seen_ids: set[int] = set()

    for topic in raw_topics:
        cat_id = topic.get("category_id", 0)
        if cat_id in excluded_ids:
            excluded_count += 1
            continue
        if not topic.get("visible", True):
            continue
        tid = topic.get("id")
        if tid and tid in seen_ids:
            continue
        processed = process_topic(topic, cat_map, sub_cat_map)
        if tid:
            seen_ids.add(tid)
        filtered.append(processed)

    filtered.sort(key=lambda x: x.created_at, reverse=True)
    return filtered, excluded_count

# ──────────────────────────────────────────────
# 帖子详情刷新
# ──────────────────────────────────────────────
async def fetch_topic_details(client: ForumClient, topic_id: int) -> Optional[dict]:
    data = await client.fetch_json(f"{FORUM_BASE}/t/{topic_id}.json")
    if not data:
        return None
    title = data.get("title", "") or data.get("fancy_title", "")
    excerpt = data.get("excerpt", "") or data.get("description", "")
    return {
        "id": data.get("id", topic_id),
        "title": title,
        "views": data.get("views", 0),
        "like_count": data.get("like_count", 0),
        "reply_count": data.get("reply_count", 0),
        "posts_count": data.get("posts_count", 0),
        "last_posted_at": data.get("last_posted_at", ""),
        "excerpt": excerpt,
        "category_id": data.get("category_id", 0),
        "image_url": data.get("image_url", ""),
        "tags": data.get("tags", []),
        "pinned": data.get("pinned", False),
        "closed": data.get("closed", False),
        "archived": data.get("archived", False),
    }

async def refresh_posts(client: ForumClient, post_ids: set[int]) -> dict[int, dict]:
    if not post_ids:
        return {}
    log.info("开始刷新 %d 条帖子的详情...", len(post_ids))
    tasks = [fetch_topic_details(client, tid) for tid in post_ids]
    results: dict[int, dict] = {}
    with tqdm(total=len(tasks), desc="刷新帖子详情") as pbar:
        for coro in asyncio.as_completed(tasks):
            detail = await coro
            if detail and detail.get("id"):
                results[detail["id"]] = detail
            pbar.update(1)
    log.info("成功刷新 %d/%d 条帖子详情", len(results), len(post_ids))
    return results

def apply_refresh_data(posts: list[PostItem], refresh_data: dict[int, dict], cat_map: dict = None, sub_cat_map: dict = None) -> list[PostItem]:
    if not refresh_data:
        return posts
    post_map = {p.id: p for p in posts}
    for pid, detail in refresh_data.items():
        if pid in post_map:
            p = post_map[pid]
            p.title = detail.get("title", p.title)
            p.views = detail.get("views", p.views)
            p.like_count = detail.get("like_count", p.like_count)
            p.reply_count = detail.get("reply_count", p.reply_count)
            p.posts_count = detail.get("posts_count", p.posts_count)
            p.last_posted_at = detail.get("last_posted_at", p.last_posted_at)
            if detail.get("excerpt"):
                p.excerpt = truncate_excerpt(detail["excerpt"])
            if detail.get("image_url"):
                p.image_url = resolve_image_url(detail["image_url"])
            if detail.get("category_id") and cat_map is not None and sub_cat_map is not None:
                resolved_id, cat_name = resolve_category_id(detail["category_id"], cat_map, sub_cat_map)
                p.category_id = resolved_id
                p.category_name = cat_name
            if detail.get("tags"):
                tags = normalize_tags(detail["tags"])
                if tags:
                    p.tags = tags
            p.pinned = detail.get("pinned", p.pinned)
            p.closed = detail.get("closed", p.closed)
            p.archived = detail.get("archived", p.archived)
    return posts

# ──────────────────────────────────────────────
# 增量更新
# ──────────────────────────────────────────────
def load_existing_data() -> tuple[dict, set[int]]:
    if not OUTPUT_PATH.exists():
        return {}, set()

    try:
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        existing_ids = {p["id"] for p in data.get("posts", []) if p.get("id")}
        log.info("加载已有数据: %d 条帖子", len(existing_ids))
        return data, existing_ids
    except Exception as e:
        log.warning("加载已有数据失败: %s", e)
        return {}, set()

def has_post_changed(post: PostItem, existing: dict) -> bool:
    """对比列表 API 数据与已有数据，判断帖子是否需要刷新详情。"""
    return (
        post.views != existing.get("views", 0)
        or post.like_count != existing.get("like_count", 0)
        or post.reply_count != existing.get("reply_count", 0)
        or post.posts_count != existing.get("posts_count", 0)
        or post.last_posted_at != existing.get("last_posted_at", "")
    )

def apply_existing_detail(post: PostItem, existing: dict) -> None:
    """将已有详情数据复用到帖子（原地更新），保留列表 API 的新鲜分类信息。"""
    post.title = existing.get("title", post.title)
    post.excerpt = existing.get("excerpt", post.excerpt)
    post.image_url = existing.get("image_url", post.image_url)
    post.tags = existing.get("tags", post.tags)
    post.views = existing.get("views", post.views)
    post.like_count = existing.get("like_count", post.like_count)
    post.reply_count = existing.get("reply_count", post.reply_count)
    post.posts_count = existing.get("posts_count", post.posts_count)
    post.last_posted_at = existing.get("last_posted_at", post.last_posted_at)
    post.pinned = existing.get("pinned", post.pinned)
    post.closed = existing.get("closed", post.closed)
    post.archived = existing.get("archived", post.archived)

def determine_posts_to_refresh(
    posts: list[PostItem],
    existing_map: dict[int, dict],
) -> tuple[set[int], int]:
    """确定需要刷新详情的帖子。
    - 新帖子或有变化的帖子 → 加入刷新集合（有变化时先复用已有详情作为基础，刷新失败仍有完整数据）
    - 无变化的帖子 → 直接复用已有详情
    返回 (需刷新的ID集合, 复用数量)。
    """
    ids_to_refresh: set[int] = set()
    reused = 0
    for post in posts:
        existing = existing_map.get(post.id)
        if not existing or has_post_changed(post, existing):
            if existing:
                apply_existing_detail(post, existing)
            ids_to_refresh.add(post.id)
        else:
            apply_existing_detail(post, existing)
            reused += 1
    return ids_to_refresh, reused

# ──────────────────────────────────────────────
# 已删除帖子检测（两段式确认）
# ──────────────────────────────────────────────
def reconcile_deleted_posts(
    posts: list[PostItem],
    existing_map: dict[int, dict],
    prev_stale: set[int],
) -> tuple[list[PostItem], list[int]]:
    """基于完整抓取结果检测论坛已删除的帖子，两段式确认避免误删。

    仅在分页自然结束（列表完整可信）时调用。对比当前列表与已有数据，
    对论坛列表中缺失的已有帖子分两种处理：
    - 上一轮已标记待删除（ID 在 prev_stale 中）→ 本轮确认删除，从输出移除
    - 首次缺失 → 本轮从已有数据恢复回输出继续展示，并标记待删除，下轮复核
    返回 (合并后的帖子列表, 本轮待删除标记ID列表)。
    """
    current_ids = {p.id for p in posts}
    missing = sorted(pid for pid in existing_map if pid not in current_ids)
    if not missing:
        return posts, []

    confirmed = [pid for pid in missing if pid in prev_stale]
    new_stale = [pid for pid in missing if pid not in prev_stale]

    # 首次缺失的帖子从已有数据恢复，继续展示，等待下轮复核
    for pid in new_stale:
        try:
            posts.append(PostItem.model_validate(existing_map[pid]))
        except Exception as e:
            log.warning("恢复帖子 %d 数据失败，直接移除: %s", pid, e)
    posts.sort(key=lambda x: x.created_at, reverse=True)

    if confirmed:
        log.info("确认删除 %d 条已从论坛移除的帖子: %s", len(confirmed), confirmed)
    if new_stale:
        log.info("检测到 %d 条帖子在论坛列表中缺失，保留并标记待下轮复核: %s", len(new_stale), new_stale)
    return posts, new_stale

# ──────────────────────────────────────────────
# 输出
# ──────────────────────────────────────────────
def validate_posts(posts: list[PostItem]) -> dict:
    report = {
        "total": len(posts),
        "missing_title": 0,
        "missing_date": 0,
        "invalid_category": 0,
        "valid": 0,
    }
    for p in posts:
        issues = 0
        if not p.title:
            report["missing_title"] += 1
            issues += 1
        if not p.created_at:
            report["missing_date"] += 1
            issues += 1
        if "未知分类" in p.category_name:
            report["invalid_category"] += 1
            issues += 1
        if issues == 0:
            report["valid"] += 1
    return report

def build_output_data(
    profile: UserProfile,
    filtered_topics: list[PostItem],
    excluded_count: int,
    raw_count: int,
    excluded_names: list[str],
    stale_ids: Optional[list[int]] = None,
) -> OutputData:
    validation = validate_posts(filtered_topics)
    if validation["missing_title"] > 0 or validation["missing_date"] > 0:
        log.info(
            "数据质量: %d/%d 完整, 缺标题 %d, 缺日期 %d, 未知分类 %d",
            validation["valid"], validation["total"],
            validation["missing_title"], validation["missing_date"],
            validation["invalid_category"]
        )

    categories: dict[str, int] = {}
    for t in filtered_topics:
        cat = t.category_name
        categories[cat] = categories.get(cat, 0) + 1

    return OutputData(
        updated_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        user=profile,
        total_posts=len(filtered_topics),
        excluded_posts=excluded_count,
        categories=categories,
        posts=filtered_topics,
        _quality={
            "raw_fetched": raw_count,
            "valid_posts": validation["valid"],
            "total_posts": validation["total"],
            "stale_candidate_ids": stale_ids or [],
            "issues": {
                "missing_title": validation["missing_title"],
                "missing_date": validation["missing_date"],
                "invalid_category": validation["invalid_category"],
            }
        }
    )

def save_output_file(output: OutputData) -> Path:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    # 先写临时文件再原子替换，避免进程中断产生损坏的 posts.json
    tmp_path = OUTPUT_PATH.with_suffix(".json.tmp")
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(output.model_dump(by_alias=True), f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, OUTPUT_PATH)
    return OUTPUT_PATH

# ──────────────────────────────────────────────
# 主流程
# ──────────────────────────────────────────────
async def main():
    # 1. 环境检查
    username = os.environ.get("FORUM_USERNAME", "").strip()
    if not username:
        log.error("请设置环境变量 FORUM_USERNAME")
        sys.exit(1)

    config = load_config()

    # 2. 创建异步客户端
    headers = {
        "User-Agent": "TRAE-Post-Aggregator/2.0",
        "Accept": "application/json",
    }
    async with aiohttp.ClientSession(headers=headers) as session:
        client = ForumClient(session)

        # 3. 获取分类列表
        log.info("[1/4] 获取论坛分类列表...")
        cat_map, sub_cat_map = await fetch_category_map(client)
        if not cat_map:
            log.error("无法获取分类列表，论坛可能不可用")
            sys.exit(1)

        excluded_ids = get_excluded_ids(config, cat_map, sub_cat_map)
        excluded_names = [cat_map[i] for i in excluded_ids if i in cat_map]
        log.info("已排除分类: %s", ", ".join(excluded_names) if excluded_names else "无")

        # 4. 获取用户信息
        log.info("[2/4] 获取用户信息...")
        profile = await fetch_user_profile(client, username)
        if not profile:
            profile = UserProfile(username=username)
            log.warning("无法获取用户详情，使用基础信息继续")
        else:
            log.info("用户: %s (ID: %s)", profile.username, profile.id)

        # 5. 获取帖子列表（仅用于获取帖子ID和基础信息）
        log.info("[3/4] 获取用户帖子列表...")
        raw_topics, first_page_failed, fetch_complete = await fetch_user_topics(client, username)
        if first_page_failed:
            log.error("帖子列表抓取失败，中止运行；已有 data/posts.json 保持不变")
            sys.exit(1)
        log.info("共获取 %d 条帖子", len(raw_topics))

        # 6. 处理和筛选
        filtered_topics, excluded_count = process_and_filter_topics(
            raw_topics, cat_map, sub_cat_map, excluded_ids
        )
        log.info("筛选后: %d 条有效帖子, %d 条已排除", len(filtered_topics), excluded_count)

        # 7. 增量刷新帖子详情（仅更新有变化的帖子）
        existing_data, _ = load_existing_data()
        existing_map = {p["id"]: p for p in existing_data.get("posts", []) if p.get("id")}
        prev_stale = set((existing_data.get("_quality") or {}).get("stale_candidate_ids", []))

        # 已删除帖子检测：仅在分页自然结束（列表完整可信）时执行，
        # 非完整抓取跳过检测并保留既有待复核标记，避免分页异常导致误删
        if existing_map and fetch_complete:
            filtered_topics, stale_ids = reconcile_deleted_posts(
                filtered_topics, existing_map, prev_stale
            )
        else:
            stale_ids = sorted(prev_stale)
            if existing_map and not fetch_complete:
                log.info("本次未完成完整翻页，跳过删除检测，保留 %d 条待复核标记", len(stale_ids))

        ids_to_refresh, reused_count = determine_posts_to_refresh(
            filtered_topics, existing_map
        )
        log.info("[4/4] 增量刷新帖子详情: %d 条需刷新, %d 条复用已有数据",
                 len(ids_to_refresh), reused_count)

        if ids_to_refresh:
            refresh_data = await refresh_posts(client, ids_to_refresh)
            filtered_topics = apply_refresh_data(filtered_topics, refresh_data, cat_map, sub_cat_map)
        elif not filtered_topics:
            log.info("无帖子，跳过详情刷新")

        # 8. 构建输出
        output = build_output_data(
            profile, filtered_topics, excluded_count,
            len(raw_topics), excluded_names, stale_ids
        )
        output_path = save_output_file(output)

        # 9. 打印摘要
        log.info("=== 完成 ===")
        log.info("有效帖子: %d", len(filtered_topics))
        log.info("已排除: %d (%s)", excluded_count, ", ".join(excluded_names) if excluded_names else "无")
        log.info("分类统计: %s", json.dumps(output.categories, ensure_ascii=False))
        log.info("输出文件: %s", output_path)

if __name__ == "__main__":
    asyncio.run(main())
