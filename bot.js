const puppeteer = require("puppeteer");
const fetch = require("node-fetch");

const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const LINKS = {
  "21": "https://www.allaccess.com.ar/event/bts-21-de-octubre",
  "23": "https://www.allaccess.com.ar/event/bts-23-de-octubre",
  "24": "https://www.allaccess.com.ar/event/bts-24-de-octubre"
};

const estadoPrevio = {
  "21": false,
  "23": false,
  "24": false
};

// 📲 Telegram
async function enviarTelegram(msg) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg
      })
    });
  } catch (err) {
    console.log("Error Telegram:", err);
  }
}

// 🔎 Analizar página real
async function analizarPagina(page, fecha, link) {
  try {
    await page.goto(link, {
      waitUntil: "networkidle2",
      timeout: 0
    });

    // esperar carga dinámica
    await new Promise(r => setTimeout(r, 7000));

    const resultado = await page.evaluate(() => {
      const texto = document.body.innerText.toLowerCase();

      // disponibilidad real
      const disponible =
        (texto.includes("comprar") ||
          texto.includes("seleccionar") ||
          texto.includes("tickets")) &&
        !texto.includes("agotado");

      // sectores detectados
      const sectores = [];
      const posibles = ["campo", "platea", "cabecera", "vip"];

      posibles.forEach(s => {
        if (texto.includes(s)) sectores.push(s);
      });

      return {
        disponible,
        sectores: [...new Set(sectores)]
      };
    });

    if (resultado.disponible && !estadoPrevio[fecha]) {
      let mensaje = `🚨 BTS\nENTRADAS DISPONIBLES - FECHA ${fecha} 🔥\n`;

      if (resultado.sectores.length > 0) {
        mensaje += `Sectores: ${resultado.sectores.join(", ")}\n`;
      }

      mensaje += `Entrar:\n${link}`;

      await enviarTelegram(mensaje);

      console.log(`ALERTA REAL ${fecha}`);
      estadoPrevio[fecha] = true;
    }

    if (!resultado.disponible) {
      estadoPrevio[fecha] = false;
      console.log(`Sin disponibilidad ${fecha}`);
    }

  } catch (err) {
    console.log(`Error en ${fecha}:`, err.message);
  }
}

// 🚀 MAIN
async function main() {
  const browser = await puppeteer.launch({
    headless: true,

    // 👇 CLAVE PARA RAILWAY
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  const page = await browser.newPage();

  while (true) {
    try {
      for (const fecha in LINKS) {
        await analizarPagina(page, fecha, LINKS[fecha]);
      }
    } catch (err) {
      console.log("Error general:", err);
    }

    // ⏱ cada 5 minutos
    await new Promise(r => setTimeout(r, 300000));
  }
}

main();