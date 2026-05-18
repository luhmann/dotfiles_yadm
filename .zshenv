# uv
export PATH="/Users/jfd/.local/bin:$PATH"

# Root CA certs for sandboxed tools (macOS Security framework is blocked)
export SSL_CERT_FILE=/etc/ssl/cert.pem

# mise for non-interactive shells (agent sandbox, scripts, cron)
# Interactive shells use `mise activate zsh` from .zshrc instead.
if [[ ! -o interactive ]]; then
  export PATH="$HOME/.local/share/mise/shims:$PATH"
  export JAVA_HOME="$(mise where java 2>/dev/null)"
fi
