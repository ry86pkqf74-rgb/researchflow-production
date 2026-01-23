"""
Dropbox Upload Client

Secure file sharing integration for Dropbox.
Based on integrations_4.pdf specification.

IMPORTANT: Only enable in configurations that match your
institutional policy for regulated data.

This implementation uses the Dropbox API directly.
For production, consider using the official dropbox Python SDK.

Usage:
    from connectors.dropbox_client import upload_to_dropbox
    
    result = upload_to_dropbox(
        access_token="...",
        path="/exports/export.ris",
        content=b"..."
    )
"""

from __future__ import annotations

import json
import requests
from typing import Any, Dict, Literal, Optional


class DropboxUploadError(Exception):
    """Raised when Dropbox upload fails."""
    pass


def upload_to_dropbox(
    access_token: str,
    path: str,
    content_bytes: bytes,
    *,
    mode: Literal["add", "overwrite", "update"] = "overwrite",
    autorename: bool = False,
    timeout: int = 60
) -> Dict[str, Any]:
    """
    Upload a file to Dropbox.
    
    Uses Dropbox's content-upload style API where file bytes go in
    the request body and arguments go in headers.
    
    Args:
        access_token: OAuth2 access token for Dropbox API
        path: Dropbox path for the file (must start with /)
        content_bytes: File content as bytes
        mode: Write mode - "add" (create new), "overwrite", "update"
        autorename: If True, rename on conflict instead of failing
        timeout: Request timeout in seconds
        
    Returns:
        Dropbox API response with file metadata:
        {
            "name": "...",
            "path_lower": "...",
            "id": "...",
            "size": ...,
            "content_hash": "..."
        }
        
    Raises:
        DropboxUploadError: If upload fails
        
    Example:
        >>> result = upload_to_dropbox(
        ...     access_token="abc123",
        ...     path="/Research/exports/literature.ris",
        ...     content_bytes=b"TY  - JOUR\r\n..."
        ... )
        >>> print(result["path_lower"])
        "/research/exports/literature.ris"
    """
    # Validate path starts with /
    if not path.startswith("/"):
        path = "/" + path
    
    url = "https://content.dropboxapi.com/2/files/upload"
    
    # Dropbox uses content-upload style:
    # - Args in Dropbox-API-Arg header (JSON)
    # - Content in request body
    
    api_args = {
        "path": path,
        "mode": mode,
        "autorename": autorename,
        "mute": False  # Don't mute notifications
    }
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Dropbox-API-Arg": json.dumps(api_args),
        "Content-Type": "application/octet-stream"
    }
    
    try:
        response = requests.post(
            url,
            headers=headers,
            data=content_bytes,
            timeout=timeout
        )
        
        if response.status_code == 409:
            # Path conflict
            error_data = response.json()
            error_tag = error_data.get("error", {}).get(".tag", "unknown")
            raise DropboxUploadError(
                f"Path conflict: {error_tag}. File may already exist at {path}"
            )
        
        response.raise_for_status()
        return response.json()
        
    except requests.RequestException as e:
        raise DropboxUploadError(f"Dropbox upload failed: {e}")


def upload_to_dropbox_sdk(
    access_token: str,
    path: str,
    content_bytes: bytes
) -> Dict[str, Any]:
    """
    Upload using the official Dropbox SDK (if installed).
    
    This is the recommended approach for production.
    Install with: pip install dropbox
    
    Args:
        access_token: OAuth2 access token
        path: Dropbox path for the file
        content_bytes: File content as bytes
        
    Returns:
        File metadata as dict
    """
    try:
        import dropbox
    except ImportError:
        raise DropboxUploadError(
            "Dropbox SDK not installed. Run: pip install dropbox"
        )
    
    dbx = dropbox.Dropbox(oauth2_access_token=access_token)
    
    result = dbx.files_upload(
        content_bytes,
        path,
        mode=dropbox.files.WriteMode("overwrite")
    )
    
    # Convert to dict
    return {
        "name": result.name,
        "path_lower": result.path_lower,
        "path_display": result.path_display,
        "id": result.id,
        "size": result.size,
        "content_hash": result.content_hash
    }


def create_shared_link(
    access_token: str,
    path: str,
    *,
    requested_visibility: Literal["public", "team_only", "password"] = "public",
    password: Optional[str] = None,
    expires: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a shared link for a Dropbox file.
    
    Args:
        access_token: OAuth2 access token
        path: Dropbox path for the file
        requested_visibility: Link visibility setting
        password: Optional password (requires password visibility)
        expires: Optional expiration (ISO datetime)
        
    Returns:
        Shared link details including URL
    """
    url = "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    settings: Dict[str, Any] = {
        "requested_visibility": requested_visibility
    }
    
    if password and requested_visibility == "password":
        settings["link_password"] = password
    if expires:
        settings["expires"] = expires
    
    data = {
        "path": path,
        "settings": settings
    }
    
    try:
        response = requests.post(
            url,
            headers=headers,
            json=data,
            timeout=30
        )
        
        # Handle case where link already exists
        if response.status_code == 409:
            # Try to get existing link
            return get_shared_link(access_token, path)
        
        response.raise_for_status()
        return response.json()
        
    except requests.RequestException as e:
        raise DropboxUploadError(f"Failed to create shared link: {e}")


def get_shared_link(
    access_token: str,
    path: str
) -> Dict[str, Any]:
    """
    Get existing shared link for a file.
    
    Args:
        access_token: OAuth2 access token
        path: Dropbox path for the file
        
    Returns:
        Shared link details
    """
    url = "https://api.dropboxapi.com/2/sharing/list_shared_links"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    data = {
        "path": path,
        "direct_only": True
    }
    
    response = requests.post(
        url,
        headers=headers,
        json=data,
        timeout=30
    )
    response.raise_for_status()
    
    result = response.json()
    links = result.get("links", [])
    
    if links:
        return links[0]
    
    raise DropboxUploadError(f"No shared link found for {path}")
