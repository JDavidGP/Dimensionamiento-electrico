---
name: Vite package firewall
description: Replit dependency-install constraint for this app's Vite build tool.
---

Replit's package firewall rejected the imported Vite 5.4.21 package because of a critical CVE. Updating Vite and its React plugin to current releases allowed dependency installation and app startup.

**Why:** Without an approved Vite package, the imported app could not install its dependencies in this environment.

**How to apply:** If resetting or changing the build toolchain, verify the package is accepted by Replit's firewall and keep Node.js at 20.19+ for Vite 8 and its matching React plugin.
