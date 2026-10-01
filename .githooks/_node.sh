# Sourced by the hooks. Git runs them in a non-interactive shell, whose PATH may carry an older
# Node than .nvmrc, and pnpm then refuses to start or runs tools under the wrong version.
# Homebrew's nvm keeps nvm.sh outside NVM_DIR.
for NVM_SH in "${NVM_DIR:-$HOME/.nvm}/nvm.sh" /opt/homebrew/opt/nvm/nvm.sh /usr/local/opt/nvm/nvm.sh; do
  if [ -s "$NVM_SH" ]; then
    . "$NVM_SH"
    nvm use --silent >/dev/null
    break
  fi
done

wanted=$(sed "s/^v//; s/\..*//" .nvmrc | tr -d "\r\n")
found=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$found" -lt "$wanted" ]; then
  echo "hooks: Node $wanted is needed (.nvmrc), found $(node -v 2>/dev/null || echo none)" >&2
  exit 1
fi
