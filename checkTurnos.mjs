import { chromium } from "playwright";
import fetch from "node-fetch";

// CONFIGURA TUS DATOS
const TELEGRAM_TOKEN = "7877655389:AAF0Z2exI50hBFly_4vMEXKvg48ztsNT_OI";
const TELEGRAM_CHAT_ID = "7637116990";
const URL = "https://www.unionpersonal.com.ar/modulos/afiliados/login"; // reemplazá con tu URL real

async function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    }),
  });

  if (!res.ok) {
    console.error("Error al enviar mensaje de Telegram:", await res.text());
  }
}

async function checkTurnos() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(URL);

    // Login

    await page.fill("#LoginDoc", "34152846");
    await page.fill("#LoginPass", "34152846");
    await page.evaluate(() => {
      IniciarSesionPaginalogin();
    });

    try {
      await page.waitForSelector("#HEADER", { timeout: 5000 });
      console.log("✅ Login exitoso");
    } catch (e) {
      console.log("❌ Login fallido o página no respondió a tiempo");
      await sendTelegramMessage("⚠️ Error al iniciar sesión en la web médica.");
      await browser.close();
      return;
    }
    // Ir a la sección de turnos
    await page.click('a[href="/modulos/afiliados/turnos/?op=solicitud"]');
    await page.waitForURL("**/proximosturnos.faces");

    // Hacer clic en "Solicitar Turno"
    await page.click('button:has-text("Solicitar Turno")');
    await page.waitForURL("**/nuevoturno.faces");

    // Elegir "PROFESIONAL"
    await page.selectOption("select#formPrincipal\\:j_idt110_input", "M");
    await page.waitForTimeout(1500); // Esperar recarga dinámica

    // Elegir "Rapallo Carlos"
    const option = await page.$(
      'select#formPrincipal\\:j_idt120_input option:text("RAPALLO, CARLOS")'
    );
    if (option) {
      const value = await option.getAttribute("value");
      await page.selectOption("#formPrincipal\\:j_idt120_input", {
        value: value,
      });
      console.log("¡Rapallo, Carlos seleccionado!");
    } else {
      console.log("No se encontró la opción Rapallo, Carlos");
    }
    await page.waitForTimeout(1500);

    // Elegir la práctica
    // Primero, encontramos las opciones y su texto visible
    const opciones = await page.$$(
      "select#formPrincipal\\:j_idt128_input option"
    );
    let valorConsulta = null;

    for (const opcion of opciones) {
      const texto = await opcion.textContent(); // Esto te da el texto visible de cada opción
      if (texto.includes("CONSULTA MEDICA CARDIOLOGIA ADULTOS")) {
        valorConsulta = await opcion.getAttribute("value"); // Obtenemos el value de la opción
        break;
      }
    }

    // Si no encontramos la opción
    if (!valorConsulta) {
      console.error(
        "⚠️ No se encontró la consulta médica 'CARDIOLOGIA ADULTOS'."
      );
      await sendTelegramMessage(
        "⚠️ No se encontró la consulta médica 'CARDIOLOGIA ADULTOS'."
      );
      await browser.close();
      return;
    }

    // Ahora seleccionamos la opción usando el valor encontrado
    await page.selectOption(
      "select#formPrincipal\\:j_idt128_input",
      valorConsulta
    );
    await page.waitForTimeout(1500); // Esperamos un poco
    console.log("✔️ Consulta médica seleccionada exitosamente.");
    await page.waitForTimeout(3000); // Tiempo para que aparezca el cartel si no hay turnos

    // Verificar si aparece el mensaje de "no hay turnos"
    const sinTurnos = await page.$("span.ui-messages-warn-detail");
    if (sinTurnos) {
      console.log("❌ Sin turnos disponibles.");
    } else {
      console.log("✅ ¡Turnos disponibles!");
      await sendTelegramMessage(
        "📅 ¡Hay turnos disponibles con Rapallo Carlos! Ingresá ya."
      );
    }
  } finally {
    await browser.close();
  }
}

checkTurnos();
