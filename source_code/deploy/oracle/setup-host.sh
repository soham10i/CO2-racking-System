#!/usr/bin/env bash
# One-time host preparation for an Ubuntu 22.04/24.04 (aarch64) Always Free A1 VM. Run as the ubuntu user:
#   bash setup-host.sh
set -euo pipefail

sudo apt-get update
sudo apt-get -y upgrade
sudo apt-get install -y docker.io docker-compose-v2 unattended-upgrades iptables-persistent git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

# Oracle's Ubuntu images ship iptables rules that REJECT everything except SSH, in addition to the
# VCN security list. Open 80/443 on the host (the security list must allow them too).
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null ||
    sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport "$port" -j ACCEPT
done
sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null ||
  sudo iptables -I INPUT 5 -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save

sudo mkdir -p /var/backups/co2tracker
sudo chown "$USER" /var/backups/co2tracker

echo "Done. Log out and back in (docker group), then: cd deploy/oracle && cp .env.example .env && nano .env"
