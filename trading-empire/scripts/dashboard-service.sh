#!/usr/bin/env bash
# TradeEmpire — Gestion du service dashboard (systemd user)
# Usage:
#   ./scripts/dashboard-service.sh start   — active et démarre le service (permanent)
#   ./scripts/dashboard-service.sh stop    — arrête le service
#   ./scripts/dashboard-service.sh status  — statut du service
#   ./scripts/dashboard-service.sh enable-linger — démarrage après reboot sans être connecté

set -e
SERVICE="tradeempire-dashboard.service"

case "${1:-}" in
  start)
    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE"
    systemctl --user start "$SERVICE"
    echo "Dashboard démarré en permanent. URL: http://127.0.0.1:3580"
    systemctl --user status "$SERVICE" --no-pager
    ;;
  stop)
    systemctl --user stop "$SERVICE" 2>/dev/null || true
    systemctl --user disable "$SERVICE" 2>/dev/null || true
    echo "Dashboard arrêté."
    ;;
  status)
    systemctl --user status "$SERVICE" --no-pager 2>/dev/null || echo "Service non actif."
    ;;
  enable-linger)
    loginctl enable-linger "$USER"
    echo "Linger activé: le dashboard redémarrera après reboot même sans session ouverte."
    ;;
  *)
    echo "Usage: $0 {start|stop|status|enable-linger}"
    exit 1
    ;;
esac
