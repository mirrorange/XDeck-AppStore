# Cloudflared helpers shared by this app's scripts (after lib.sh).

CLOUDFLARED_VERSION=2026.11.1
BIN="$APP_DIR/bin/cloudflared"
CONF_DIR="$APP_DIR/conf"

# The release file for this system and its pinned SHA-256.
release_file() {
  case "$(os_id)-$(arch)" in
    linux-x86_64) echo "cloudflared-linux-amd64 97bb3b02d23a5980fc9c15a1a270e692da1923f103f920d5b16d4931d5ab55e7" ;;
    linux-aarch64) echo "cloudflared-linux-arm64 b155cec3e48e489cfb8e5c602769fb8c771083018d8881d68b4d18a791567c5a" ;;
    macos-x86_64) echo "cloudflared-darwin-amd64.tgz 5e0403b188dfee71fbd9b995e7dc9910d61b661c52371935ab6475d41185632f" ;;
    macos-aarch64) echo "cloudflared-darwin-arm64.tgz 02fe4bcf08f2c09699cff30658228a739a0c47fb75f3653d1b8772a27ade4462" ;;
  esac
}
