"""
Box Upload Client

Secure file sharing integration for Box.
Based on integrations_4.pdf specification.

IMPORTANT: Only enable in configurations that match your
institutional policy for regulated data.

Usage:
    from connectors.box_client import upload_to_box
    
    result = upload_to_box(
        access_token="...",
        folder_id="0",  # 0 = root folder
        filename="export.ris",
        content=b"..."
    )
"""

from __future__ import annotations

import requests
from typing import Any, Dict, Optional


class BoxUploadError(Exception):
    """Raised when Box upload fails."""
    pass


def upload_to_box(
    access_token: str,
    folder_id: str,
    filename: str,
    content_bytes: bytes,
    *,
    timeout: int = 60,
    on_conflict: str = "fail"  # "fail", "rename", or "overwrite"
) -> Dict[str, Any]:
    """
    Upload a file to Box.
    
    Uses Box's direct upload API for files under 50MB.
    For larger files, use chunked upload (not implemented here).
    
    Args:
        access_token: OAuth2 access token for Box API
        folder_id: Box folder ID ("0" for root folder)
        filename: Name for the uploaded file
        content_bytes: File content as bytes
        timeout: Request timeout in seconds
        on_conflict: Conflict resolution strategy
        
    Returns:
        Box API response with file metadata:
        {
            "id": "...",
            "name": "...",
            "size": ...,
            "created_at": "...",
            "modified_at": "...",
            "shared_link": {...}  # if created
        }
        
    Raises:
        BoxUploadError: If upload fails
        
    Example:
        >>> result = upload_to_box(
        ...     access_token="abc123",
        ...     folder_id="12345",
        ...     filename="export.ris",
        ...     content_bytes=b"TY  - JOUR\r\n..."
        ... )
        >>> print(result["id"])
        "987654321"
    """
    url = "https://upload.box.com/api/2.0/files/content"
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # Box requires 'attributes' as JSON and 'file' as the content
    # The attributes field specifies name and parent folder
    import json
    attributes = json.dumps({
        "name": filename,
        "parent": {"id": folder_id}
    })
    
    files = {
        "attributes": (None, attributes, "application/json"),
        "file": (filename, content_bytes, "application/octet-stream")
    }
    
    try:
        response = requests.post(
            url,
            headers=headers,
            files=files,
            timeout=timeout
        )
        
        if response.status_code == 409:
            # Conflict - file already exists
            if on_conflict == "fail":
                raise BoxUploadError(
                    f"File '{filename}' already exists in folder {folder_id}"
                )
            elif on_conflict == "rename":
                # Retry with modified name
                import time
                new_name = f"{filename.rsplit('.', 1)[0]}_{int(time.time())}.{filename.rsplit('.', 1)[1]}"
                return upload_to_box(
                    access_token, folder_id, new_name, content_bytes,
                    timeout=timeout, on_conflict="fail"
                )
            elif on_conflict == "overwrite":
                # Get existing file ID and update
                error_data = response.json()
                existing_id = error_data.get("context_info", {}).get("conflicts", {}).get("id")
                if existing_id:
                    return update_box_file(access_token, existing_id, content_bytes, timeout)
                raise BoxUploadError("Cannot overwrite: existing file ID not found")
        
        response.raise_for_status()
        
        data = response.json()
        
        # Return first entry (Box returns array)
        if "entries" in data and data["entries"]:
            return data["entries"][0]
        
        return data
        
    except requests.RequestException as e:
        raise BoxUploadError(f"Box upload failed: {e}")


def update_box_file(
    access_token: str,
    file_id: str,
    content_bytes: bytes,
    timeout: int = 60
) -> Dict[str, Any]:
    """
    Update an existing Box file.
    
    Args:
        access_token: OAuth2 access token
        file_id: ID of the file to update
        content_bytes: New file content
        timeout: Request timeout
        
    Returns:
        Updated file metadata
    """
    url = f"https://upload.box.com/api/2.0/files/{file_id}/content"
    
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    files = {
        "file": ("content", content_bytes, "application/octet-stream")
    }
    
    response = requests.post(
        url,
        headers=headers,
        files=files,
        timeout=timeout
    )
    response.raise_for_status()
    
    data = response.json()
    if "entries" in data and data["entries"]:
        return data["entries"][0]
    return data


def create_shared_link(
    access_token: str,
    file_id: str,
    *,
    access_level: str = "open",  # "open", "company", "collaborators"
    password: Optional[str] = None,
    expires_at: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a shared link for a Box file.
    
    Args:
        access_token: OAuth2 access token
        file_id: ID of the file
        access_level: Who can access the link
        password: Optional password protection
        expires_at: Optional expiration (ISO datetime)
        
    Returns:
        Shared link details
    """
    url = f"https://api.box.com/2.0/files/{file_id}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    shared_link_config: Dict[str, Any] = {
        "access": access_level
    }
    
    if password:
        shared_link_config["password"] = password
    if expires_at:
        shared_link_config["unshared_at"] = expires_at
    
    data = {
        "shared_link": shared_link_config
    }
    
    response = requests.put(
        url,
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    
    return response.json().get("shared_link", {})
