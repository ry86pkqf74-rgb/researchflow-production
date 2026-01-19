"""
Zotero Synchronization Service

Provides bidirectional sync with Zotero libraries:
- Import collections and items
- Export citations to Zotero
- Sync attachments
- Handle tags and notes
"""

import asyncio
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import os


@dataclass
class ZoteroItem:
    """Represents a Zotero library item"""
    key: str
    item_type: str  # journalArticle, book, bookSection, etc.
    title: str
    creators: List[Dict[str, str]]  # [{"firstName": "", "lastName": "", "creatorType": ""}]
    date: Optional[str] = None
    abstract: Optional[str] = None
    publication_title: Optional[str] = None  # Journal name
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    doi: Optional[str] = None
    url: Optional[str] = None
    isbn: Optional[str] = None
    publisher: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    collections: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    date_added: Optional[str] = None
    date_modified: Optional[str] = None


@dataclass
class ZoteroCollection:
    """Represents a Zotero collection"""
    key: str
    name: str
    parent_key: Optional[str] = None
    item_count: int = 0


@dataclass
class SyncResult:
    """Result of a sync operation"""
    success: bool
    items_imported: int = 0
    items_exported: int = 0
    items_updated: int = 0
    errors: List[str] = field(default_factory=list)
    synced_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


class ZoteroClient:
    """Client for Zotero API interactions"""

    BASE_URL = "https://api.zotero.org"

    def __init__(
        self,
        api_key: Optional[str] = None,
        user_id: Optional[str] = None,
        library_type: str = "user"  # "user" or "group"
    ):
        """
        Initialize Zotero client.

        Args:
            api_key: Zotero API key
            user_id: User or group ID
            library_type: "user" or "group"
        """
        self.api_key = api_key or os.getenv("ZOTERO_API_KEY")
        self.user_id = user_id or os.getenv("ZOTERO_USER_ID")
        self.library_type = library_type

        if not self.api_key:
            raise ValueError("Zotero API key required")
        if not self.user_id:
            raise ValueError("Zotero user/group ID required")

    @property
    def _library_prefix(self) -> str:
        """Get API library prefix"""
        if self.library_type == "group":
            return f"groups/{self.user_id}"
        return f"users/{self.user_id}"

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Any:
        """Make API request to Zotero"""
        import aiohttp

        url = f"{self.BASE_URL}/{self._library_prefix}/{endpoint}"
        headers = {
            "Zotero-API-Key": self.api_key,
            "Zotero-API-Version": "3",
            "Content-Type": "application/json"
        }

        async with aiohttp.ClientSession() as session:
            async with session.request(
                method,
                url,
                headers=headers,
                json=data,
                params=params
            ) as response:
                if response.status == 204:
                    return None
                if response.status >= 400:
                    error_text = await response.text()
                    raise Exception(f"Zotero API error {response.status}: {error_text}")
                return await response.json()

    # ==================== Collections ====================

    async def get_collections(self) -> List[ZoteroCollection]:
        """Get all collections in library"""
        data = await self._request("GET", "collections")

        collections = []
        for item in data:
            coll_data = item.get("data", {})
            collections.append(ZoteroCollection(
                key=coll_data.get("key", ""),
                name=coll_data.get("name", ""),
                parent_key=coll_data.get("parentCollection"),
                item_count=item.get("meta", {}).get("numItems", 0)
            ))

        return collections

    async def create_collection(
        self,
        name: str,
        parent_key: Optional[str] = None
    ) -> ZoteroCollection:
        """Create a new collection"""
        data = [{
            "name": name,
            "parentCollection": parent_key
        }]

        result = await self._request("POST", "collections", data)

        if result.get("successful", {}).get("0"):
            created = result["successful"]["0"]
            return ZoteroCollection(
                key=created.get("key", ""),
                name=name,
                parent_key=parent_key
            )

        raise Exception(f"Failed to create collection: {result}")

    # ==================== Items ====================

    async def get_items(
        self,
        collection_key: Optional[str] = None,
        item_type: Optional[str] = None,
        limit: int = 100,
        start: int = 0
    ) -> List[ZoteroItem]:
        """Get items from library"""
        endpoint = f"collections/{collection_key}/items" if collection_key else "items"
        params = {
            "limit": limit,
            "start": start,
            "format": "json"
        }
        if item_type:
            params["itemType"] = item_type

        data = await self._request("GET", endpoint, params=params)

        items = []
        for item in data:
            item_data = item.get("data", {})
            if item_data.get("itemType") in ["note", "attachment"]:
                continue

            items.append(self._parse_item(item_data))

        return items

    async def get_item(self, key: str) -> ZoteroItem:
        """Get a single item by key"""
        data = await self._request("GET", f"items/{key}")
        return self._parse_item(data.get("data", {}))

    async def create_item(self, item: ZoteroItem) -> str:
        """Create a new item in library"""
        data = [self._serialize_item(item)]
        result = await self._request("POST", "items", data)

        if result.get("successful", {}).get("0"):
            return result["successful"]["0"].get("key", "")

        raise Exception(f"Failed to create item: {result}")

    async def update_item(self, item: ZoteroItem) -> bool:
        """Update an existing item"""
        data = self._serialize_item(item)

        # Get current version
        current = await self._request("GET", f"items/{item.key}")
        version = current.get("version", 0)

        headers = {"If-Unmodified-Since-Version": str(version)}

        try:
            await self._request("PATCH", f"items/{item.key}", data)
            return True
        except Exception as e:
            print(f"Failed to update item: {e}")
            return False

    async def delete_item(self, key: str) -> bool:
        """Delete an item"""
        try:
            await self._request("DELETE", f"items/{key}")
            return True
        except:
            return False

    # ==================== Tags ====================

    async def get_tags(self) -> List[str]:
        """Get all tags in library"""
        data = await self._request("GET", "tags")
        return [item.get("tag", "") for item in data]

    async def add_tags(self, item_key: str, tags: List[str]) -> bool:
        """Add tags to an item"""
        item = await self.get_item(item_key)
        current_tags = set(item.tags)
        current_tags.update(tags)
        item.tags = list(current_tags)
        return await self.update_item(item)

    # ==================== Search ====================

    async def search(
        self,
        query: str,
        limit: int = 50
    ) -> List[ZoteroItem]:
        """Search items in library"""
        params = {
            "q": query,
            "limit": limit,
            "format": "json"
        }

        data = await self._request("GET", "items", params=params)

        items = []
        for item in data:
            item_data = item.get("data", {})
            if item_data.get("itemType") not in ["note", "attachment"]:
                items.append(self._parse_item(item_data))

        return items

    # ==================== Helpers ====================

    def _parse_item(self, data: Dict[str, Any]) -> ZoteroItem:
        """Parse Zotero API response to ZoteroItem"""
        creators = []
        for c in data.get("creators", []):
            creators.append({
                "firstName": c.get("firstName", ""),
                "lastName": c.get("lastName", ""),
                "creatorType": c.get("creatorType", "author")
            })

        tags = [t.get("tag", "") for t in data.get("tags", [])]

        return ZoteroItem(
            key=data.get("key", ""),
            item_type=data.get("itemType", "journalArticle"),
            title=data.get("title", ""),
            creators=creators,
            date=data.get("date"),
            abstract=data.get("abstractNote"),
            publication_title=data.get("publicationTitle"),
            volume=data.get("volume"),
            issue=data.get("issue"),
            pages=data.get("pages"),
            doi=data.get("DOI"),
            url=data.get("url"),
            isbn=data.get("ISBN"),
            publisher=data.get("publisher"),
            tags=tags,
            collections=data.get("collections", []),
            date_added=data.get("dateAdded"),
            date_modified=data.get("dateModified")
        )

    def _serialize_item(self, item: ZoteroItem) -> Dict[str, Any]:
        """Serialize ZoteroItem to API format"""
        data = {
            "itemType": item.item_type,
            "title": item.title,
            "creators": item.creators,
            "tags": [{"tag": t} for t in item.tags],
            "collections": item.collections
        }

        if item.date:
            data["date"] = item.date
        if item.abstract:
            data["abstractNote"] = item.abstract
        if item.publication_title:
            data["publicationTitle"] = item.publication_title
        if item.volume:
            data["volume"] = item.volume
        if item.issue:
            data["issue"] = item.issue
        if item.pages:
            data["pages"] = item.pages
        if item.doi:
            data["DOI"] = item.doi
        if item.url:
            data["url"] = item.url
        if item.isbn:
            data["ISBN"] = item.isbn
        if item.publisher:
            data["publisher"] = item.publisher

        return data


class ZoteroSyncService:
    """High-level sync service for Zotero integration"""

    def __init__(self, client: ZoteroClient):
        self.client = client
        self._last_sync: Optional[datetime] = None

    async def import_library(
        self,
        collection_key: Optional[str] = None,
        limit: int = 500
    ) -> SyncResult:
        """Import items from Zotero library"""
        result = SyncResult(success=True)

        try:
            items = await self.client.get_items(
                collection_key=collection_key,
                limit=limit
            )
            result.items_imported = len(items)

            # Store items locally (implement your storage logic)
            for item in items:
                await self._store_item(item)

        except Exception as e:
            result.success = False
            result.errors.append(str(e))

        return result

    async def export_to_zotero(
        self,
        items: List[ZoteroItem],
        collection_name: Optional[str] = None
    ) -> SyncResult:
        """Export items to Zotero library"""
        result = SyncResult(success=True)

        try:
            # Create collection if specified
            collection_key = None
            if collection_name:
                collection = await self.client.create_collection(collection_name)
                collection_key = collection.key

            for item in items:
                if collection_key:
                    item.collections.append(collection_key)

                try:
                    await self.client.create_item(item)
                    result.items_exported += 1
                except Exception as e:
                    result.errors.append(f"Failed to export {item.title}: {e}")

        except Exception as e:
            result.success = False
            result.errors.append(str(e))

        return result

    async def sync_bidirectional(
        self,
        local_items: List[ZoteroItem]
    ) -> SyncResult:
        """Perform bidirectional sync between local and Zotero"""
        result = SyncResult(success=True)

        try:
            # Get remote items
            remote_items = await self.client.get_items()
            remote_by_key = {item.key: item for item in remote_items}
            local_by_key = {item.key: item for item in local_items if item.key}

            # Items to push (local only or local newer)
            for key, local_item in local_by_key.items():
                if key not in remote_by_key:
                    # New local item - push to Zotero
                    await self.client.create_item(local_item)
                    result.items_exported += 1
                elif local_item.date_modified and remote_by_key[key].date_modified:
                    if local_item.date_modified > remote_by_key[key].date_modified:
                        await self.client.update_item(local_item)
                        result.items_updated += 1

            # Items to pull (remote only or remote newer)
            for key, remote_item in remote_by_key.items():
                if key not in local_by_key:
                    # New remote item - import locally
                    await self._store_item(remote_item)
                    result.items_imported += 1

            self._last_sync = datetime.utcnow()

        except Exception as e:
            result.success = False
            result.errors.append(str(e))

        return result

    async def _store_item(self, item: ZoteroItem) -> None:
        """Store item locally (implement based on your storage)"""
        # This would integrate with your local database/storage
        pass


# Factory function
def create_zotero_client(
    api_key: Optional[str] = None,
    user_id: Optional[str] = None
) -> ZoteroClient:
    """Create a Zotero client instance"""
    return ZoteroClient(api_key=api_key, user_id=user_id)


# Example usage
if __name__ == "__main__":
    async def main():
        # Initialize client
        client = ZoteroClient(
            api_key="your-api-key",
            user_id="your-user-id"
        )

        # Get collections
        collections = await client.get_collections()
        print(f"Found {len(collections)} collections")

        # Get items
        items = await client.get_items(limit=10)
        print(f"Found {len(items)} items")

        for item in items[:3]:
            print(f"- {item.title} ({item.item_type})")

    asyncio.run(main())
