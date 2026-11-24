# Sourced via BASH_ENV inside the nono pi-jvm sandbox. Points JVMs at the per-session nono proxy and CA.
[ -n "${DASH0_BASE_URL:-}" ] && export DASH0_API_URL="$DASH0_BASE_URL"
[ -n "${ZALANDO_NEXUS_TOKEN:-}" ] && export NPM_TOKEN="$ZALANDO_NEXUS_TOKEN"
case ":$PATH:" in
  *":$HOME/.config/nono/bin/shims:"*) ;;
  *) export PATH="$HOME/.config/nono/bin/shims:$PATH" ;;
esac
if [ -n "${HTTPS_PROXY:-}" ] && [ -n "${SSL_CERT_FILE:-}" ] && [ -f "$SSL_CERT_FILE" ]; then
  _nono_hostport=${HTTPS_PROXY##*@}
  _nono_hostport=${_nono_hostport#http://}
  _nono_hostport=${_nono_hostport%/}
  export NONO_PROXY_HOST=${_nono_hostport%:*}
  export NONO_PROXY_PORT=${_nono_hostport##*:}

  _nono_ts="${TMPDIR%/}/nono-jvm-$(basename "$(dirname "$SSL_CERT_FILE")").p12"
  if [ ! -s "$_nono_ts" ] && [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/keytool" ]; then
    _nono_work=$(mktemp -d)
    awk -v d="$_nono_work" '/BEGIN CERT/{n++} n{print > (d "/" n ".pem")}' "$SSL_CERT_FILE"
    cp "$JAVA_HOME/lib/security/cacerts" "$_nono_work/ts.p12" && chmod u+w "$_nono_work/ts.p12"
    for _nono_pem in "$_nono_work"/*.pem; do
      if openssl x509 -in "$_nono_pem" -noout -subject 2>/dev/null | grep -q 'nono-session-ca'; then
        "$JAVA_HOME/bin/keytool" -importcert -noprompt -alias nono-session-ca -file "$_nono_pem" \
          -keystore "$_nono_work/ts.p12" -storepass changeit >/dev/null 2>&1 \
          && mv "$_nono_work/ts.p12" "$_nono_ts"
      fi
    done
    rm -rf "$_nono_work"
  fi

  _nono_opts="-Djava.net.preferIPv4Stack=true -Djdk.attach.allowAttachSelf=true"
  _nono_opts="$_nono_opts -Dhttp.proxyHost=$NONO_PROXY_HOST -Dhttp.proxyPort=$NONO_PROXY_PORT"
  _nono_opts="$_nono_opts -Dhttps.proxyHost=$NONO_PROXY_HOST -Dhttps.proxyPort=$NONO_PROXY_PORT"
  _nono_opts="$_nono_opts -Dhttp.nonProxyHosts=localhost|127.0.0.1|::1"
  _nono_opts="$_nono_opts -Dhttps.proxyUser=nono -Dhttps.proxyPassword=${NONO_PROXY_TOKEN:-}"
  _nono_opts="$_nono_opts -Djdk.http.auth.tunneling.disabledSchemes="
  if [ -s "$_nono_ts" ]; then
    _nono_opts="$_nono_opts -Djavax.net.ssl.trustStore=$_nono_ts -Djavax.net.ssl.trustStorePassword=changeit"
  fi
  export JDK_JAVA_OPTIONS="$_nono_opts"
  unset _nono_hostport _nono_ts _nono_work _nono_pem _nono_opts
fi
