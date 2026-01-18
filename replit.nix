{ pkgs }: {
  deps = [
    # Node.js 20 for orchestrator and web
    pkgs.nodejs_20
    pkgs.nodePackages.npm
    pkgs.nodePackages.typescript
    pkgs.nodePackages.typescript-language-server

    # Python 3.11 for worker
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.python311Packages.uvicorn
    pkgs.python311Packages.fastapi
    pkgs.python311Packages.redis
    pkgs.python311Packages.psycopg2
    pkgs.python311Packages.httpx
    pkgs.python311Packages.pydantic

    # PostgreSQL
    pkgs.postgresql_16

    # Redis
    pkgs.redis

    # Build tools
    pkgs.gnumake
    pkgs.gcc
    pkgs.openssl

    # Utilities
    pkgs.curl
    pkgs.jq
    pkgs.procps
    pkgs.lsof
  ];

  env = {
    NODE_ENV = "production";
    PYTHONPATH = "${builtins.getEnv "REPL_HOME"}/services/worker/src:${builtins.getEnv "REPL_HOME"}/services/worker";
    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
      pkgs.openssl
      pkgs.postgresql_16.lib
    ];
  };
}
