#!/bin/bash
exec cloudflared tunnel --url "http://localhost:${WEB_PORT:?}" > >(sed -u 's/^/web: /') 2>&1
