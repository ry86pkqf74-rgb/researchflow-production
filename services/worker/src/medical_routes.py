"""
Medical Integrations API Routes

Exposes REDCap, Epic FHIR, PubMed, and cache functionality via FastAPI.

Based on document_pdf.pdf specification.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import os

router = APIRouter(prefix="/api/medical", tags=["medical-integrations"])


# ============ Data Models ============

class RedcapExportInput(BaseModel):
    filter_logic: Optional[str] = None
    fields: Optional[List[str]] = None
    forms: Optional[List[str]] = None

class EpicSearchInput(BaseModel):
    patient_id: str
    resource_type: str = "Procedure"
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class PubmedSearchInput(BaseModel):
    query: str
    max_results: int = 20

class EvidenceSearchInput(BaseModel):
    procedure: str
    topic: str
    keywords: Optional[List[str]] = None
    min_articles: int = 3

class CacheTestInput(BaseModel):
    key: str
    value: Optional[Dict[str, Any]] = None
    ttl_s: Optional[int] = None


# ============ REDCap Endpoints ============

@router.get("/redcap/status")
async def redcap_status():
    """Check REDCap configuration status"""
    configured = bool(os.getenv("REDCAP_API_URL")) and bool(os.getenv("REDCAP_API_TOKEN"))
    return {
        "status": "configured" if configured else "not_configured",
        "api_url_set": bool(os.getenv("REDCAP_API_URL")),
        "token_set": bool(os.getenv("REDCAP_API_TOKEN")),
        "timeout_s": int(os.getenv("REDCAP_TIMEOUT_S", "60"))
    }

@router.post("/redcap/export")
async def redcap_export_records(input_data: RedcapExportInput):
    """Export records from REDCap project"""
    try:
        from data_ingestion.redcap.client import RedcapClient
        from data_ingestion.redcap.mapper import batch_convert_records
        
        client = RedcapClient.from_env()
        records = client.export_records(
            filter_logic=input_data.filter_logic,
            fields=input_data.fields,
            forms=input_data.forms
        )
        
        # Convert to SurgicalCase objects
        cases = batch_convert_records(records)
        
        return {
            "status": "success",
            "record_count": len(records),
            "case_count": len(cases),
            "cases": [
                {
                    "case_id": c.case_id,
                    "procedure": c.procedure,
                    "procedure_date": c.procedure_date,
                    "service_line": c.service_line,
                    "outcomes": c.outcomes
                }
                for c in cases[:50]  # Limit response size
            ]
        }
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"REDCap module not available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/redcap/metadata")
async def redcap_get_metadata():
    """Get REDCap project metadata"""
    try:
        from data_ingestion.redcap.client import RedcapClient
        
        client = RedcapClient.from_env()
        metadata = client.export_metadata()
        project_info = client.export_project_info()
        
        return {
            "status": "success",
            "project": project_info,
            "field_count": len(metadata),
            "fields": metadata[:100]  # Limit response
        }
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"REDCap module not available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Epic FHIR Endpoints ============

@router.get("/epic/status")
async def epic_status():
    """Check Epic FHIR configuration status"""
    configured = all([
        os.getenv("EPIC_FHIR_BASE_URL"),
        os.getenv("EPIC_TOKEN_URL"),
        os.getenv("EPIC_CLIENT_ID"),
        os.getenv("EPIC_PRIVATE_KEY_PEM")
    ])
    return {
        "status": "configured" if configured else "not_configured",
        "fhir_base_url_set": bool(os.getenv("EPIC_FHIR_BASE_URL")),
        "token_url_set": bool(os.getenv("EPIC_TOKEN_URL")),
        "client_id_set": bool(os.getenv("EPIC_CLIENT_ID")),
        "private_key_set": bool(os.getenv("EPIC_PRIVATE_KEY_PEM")),
        "timeout_s": int(os.getenv("EPIC_TIMEOUT_S", "60"))
    }

@router.post("/epic/search")
async def epic_search_resources(input_data: EpicSearchInput):
    """Search Epic FHIR resources"""
    try:
        from data_ingestion.epic.fhir_client import EpicFHIRClient
        from data_ingestion.epic.mapper import bundle_to_cases
        
        client = EpicFHIRClient.from_env()
        
        date_filter = None
        if input_data.date_from:
            date_filter = f"ge{input_data.date_from}"
        
        if input_data.resource_type == "Procedure":
            bundle = client.search_procedures(
                input_data.patient_id,
                date=date_filter
            )
        elif input_data.resource_type == "Encounter":
            bundle = client.search_encounters(
                input_data.patient_id,
                date=date_filter
            )
        elif input_data.resource_type == "DocumentReference":
            bundle = client.search_document_references(input_data.patient_id)
        else:
            bundle = client.search(
                input_data.resource_type,
                patient=input_data.patient_id
            )
        
        cases = bundle_to_cases(bundle)
        
        return {
            "status": "success",
            "resource_type": input_data.resource_type,
            "total": bundle.get("total", len(cases)),
            "cases": [
                {
                    "case_id": c.case_id,
                    "procedure": c.procedure,
                    "procedure_date": c.procedure_date,
                    "source": c.source
                }
                for c in cases[:50]
            ]
        }
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Epic FHIR module not available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ PubMed / Evidence Endpoints ============

@router.get("/pubmed/status")
async def pubmed_status():
    """Check PubMed configuration status"""
    return {
        "status": "available",
        "api_key_set": bool(os.getenv("NCBI_API_KEY")),
        "rate_limit": "10/sec" if os.getenv("NCBI_API_KEY") else "3/sec",
        "cache_ttl_s": int(os.getenv("PUBMED_CACHE_TTL_S", "86400"))
    }

@router.post("/pubmed/search")
async def pubmed_search(input_data: PubmedSearchInput):
    """Search PubMed for articles"""
    try:
        from medical_validation.pubmed_client import PubMedClient
        
        client = PubMedClient.from_env()
        results = client.search_with_summaries(
            input_data.query,
            max_results=input_data.max_results
        )
        
        return {
            "status": "success",
            "query": input_data.query,
            "count": results["count"],
            "articles": results["articles"]
        }
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"PubMed module not available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evidence/validate")
async def validate_evidence(input_data: EvidenceSearchInput):
    """Find evidence for a surgical claim"""
    try:
        from medical_validation.pubmed_client import PubMedClient
        from medical_validation.evidence_linker import EvidenceLinker
        
        client = PubMedClient.from_env()
        linker = EvidenceLinker(client)
        
        result = linker.find_for_surgical_claim(
            procedure=input_data.procedure,
            topic=input_data.topic,
            optional_keywords=input_data.keywords
        )
        
        validated = linker.validate_claim(
            result,
            min_articles=input_data.min_articles
        )
        
        return {
            "status": "success",
            "query": result.query,
            "article_count": result.count,
            "validated": validated,
            "min_required": input_data.min_articles,
            "articles": result.articles[:20]
        }
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Evidence linker module not available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Cache Endpoints ============

@router.get("/cache/status")
async def cache_status():
    """Check Redis cache configuration and connectivity"""
    try:
        from cache.redis_cache import RedisCache
        
        cache = RedisCache.from_env()
        connected = cache.ping()
        
        return {
            "status": "connected" if connected else "disconnected",
            "redis_url": os.getenv("REDIS_URL", "redis://localhost:6379/0"),
            "prefix": os.getenv("CACHE_PREFIX", "worker"),
            "default_ttl_s": int(os.getenv("CACHE_TTL_S", "86400")),
            "encryption_enabled": bool(os.getenv("CACHE_FERNET_KEY"))
        }
    except ImportError as e:
        return {
            "status": "module_not_available",
            "error": str(e)
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.post("/cache/test")
async def cache_test(input_data: CacheTestInput):
    """Test cache set/get operations"""
    try:
        from cache.redis_cache import RedisCache
        
        cache = RedisCache.from_env()
        
        if input_data.value is not None:
            # Set operation
            success = cache.set_json(
                input_data.key,
                input_data.value,
                ttl_s=input_data.ttl_s
            )
            return {
                "operation": "set",
                "key": input_data.key,
                "success": success
            }
        else:
            # Get operation
            value = cache.get_json(input_data.key)
            ttl = cache.ttl(input_data.key)
            return {
                "operation": "get",
                "key": input_data.key,
                "value": value,
                "ttl_remaining": ttl,
                "exists": value is not None
            }
    except ImportError as e:
        raise HTTPException(status_code=503, detail=f"Cache module not available: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ Execution Backend Endpoints ============

@router.get("/execution/status")
async def execution_status():
    """Check execution backend configuration"""
    backend = os.getenv("EXECUTION_BACKEND", "local")
    
    ray_available = False
    try:
        import ray
        ray_available = True
    except ImportError:
        pass
    
    return {
        "backend": backend,
        "ray_available": ray_available,
        "ray_address": os.getenv("RAY_ADDRESS"),
        "num_actors": int(os.getenv("RAY_NUM_ACTORS", "8")),
        "max_in_flight": int(os.getenv("RAY_MAX_IN_FLIGHT", "64"))
    }


# ============ Integration Status Endpoint ============

@router.get("/status")
async def medical_integrations_status():
    """Get status of all medical integrations"""
    redcap_configured = bool(os.getenv("REDCAP_API_URL")) and bool(os.getenv("REDCAP_API_TOKEN"))
    epic_configured = all([
        os.getenv("EPIC_FHIR_BASE_URL"),
        os.getenv("EPIC_TOKEN_URL"),
        os.getenv("EPIC_CLIENT_ID"),
        os.getenv("EPIC_PRIVATE_KEY_PEM")
    ])
    
    # Check module availability
    modules = {}
    try:
        from data_ingestion.redcap.client import RedcapClient
        modules["redcap"] = "available"
    except ImportError:
        modules["redcap"] = "not_installed"
    
    try:
        from data_ingestion.epic.fhir_client import EpicFHIRClient
        modules["epic"] = "available"
    except ImportError:
        modules["epic"] = "not_installed"
    
    try:
        from medical_validation.pubmed_client import PubMedClient
        modules["pubmed"] = "available"
    except ImportError:
        modules["pubmed"] = "not_installed"
    
    try:
        from cache.redis_cache import RedisCache
        modules["cache"] = "available"
    except ImportError:
        modules["cache"] = "not_installed"
    
    try:
        from execution.ray_llm_executor import map_chunks
        modules["execution"] = "available"
    except ImportError:
        modules["execution"] = "not_installed"
    
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "configuration": {
            "redcap": "configured" if redcap_configured else "not_configured",
            "epic": "configured" if epic_configured else "not_configured",
            "pubmed": "configured" if os.getenv("NCBI_API_KEY") else "basic",
            "cache": "configured" if os.getenv("REDIS_URL") else "default",
            "execution": os.getenv("EXECUTION_BACKEND", "local")
        },
        "modules": modules
    }
