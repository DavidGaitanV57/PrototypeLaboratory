/**
 * 2D minimap canvas — track dots, player, rivals. Genre-agnostic.
 */

export function createMinimap(hudPanelEl, { size = 160, label = "MAP" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "plab-hud__minimap";
  const lab = document.createElement("div");
  lab.className = "plab-hud__label";
  lab.textContent = label;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  wrap.append(lab, canvas);
  hudPanelEl.appendChild(wrap);
  const ctx = canvas.getContext("2d");

  let bounds = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  const dots = [];

  function setBounds(minX, maxX, minZ, maxZ) {
    bounds = { minX, maxX, minZ, maxZ };
  }

  function worldToCanvas(x, z) {
    const { minX, maxX, minZ, maxZ } = bounds;
    const u = (x - minX) / Math.max(1e-6, maxX - minX);
    const v = (z - minZ) / Math.max(1e-6, maxZ - minZ);
    const pad = 8;
    const w = canvas.width - pad * 2;
    const h = canvas.height - pad * 2;
    return { x: pad + u * w, y: pad + (1 - v) * h };
  }

  function setPath(points) {
    dots.length = 0;
    for (const p of points) {
      const x = p.x ?? p[0];
      const z = p.z ?? p[2];
      dots.push({ x, z, color: "#8bc34a", r: 2 });
    }
  }

  function setMarkers(markers) {
    for (const m of markers) {
      dots.push({
        x: m.x,
        z: m.z,
        color: m.color || "#fff",
        r: m.r ?? 4,
      });
    }
  }

  function draw(staticPath = [], markers = []) {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,40,0,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < staticPath.length; i++) {
      const p = worldToCanvas(staticPath[i].x ?? staticPath[i][0], staticPath[i].z ?? staticPath[i][2]);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    for (const m of markers) {
      const p = worldToCanvas(m.x, m.z);
      ctx.fillStyle = m.color || "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, m.r ?? 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { canvas, setBounds, setPath, setMarkers, draw, worldToCanvas };
}
