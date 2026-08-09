# Pendiente: activar los avisos por Telegram

El código ya está escrito (`ci.yml` y `scripts/deploy.sh`). Falta la parte que
solo se puede hacer a mano, porque son credenciales y una máquina distinta.

## 0. Rotar el token antes de usarlo

El token que devolvió BotFather el 2026-08-09 se pegó en un chat con una IA:
tratarlo como comprometido, igual que el PAT del deploy.

`@BotFather` → `/mybots` → `@test_sitios_bot` → **Revoke current access token**.
El nuevo es el que se guarda abajo. El viejo deja de servir en el acto.

## 1. Secret del repo (CI)

```bash
gh secret set TG_TOKEN     # pega el token nuevo, no queda en el historial
```

`TG_CHAT` ya está seteado (`8535525349`, cuenta de Felipe).

Sin `TG_TOKEN` el step de CI sale con 0 y no rompe nada — simplemente no avisa.

## 2. Env del CT de producción (deploy)

Otra máquina: `10.10.10.12`, cwd `/var/www/casa-origen`. No se llega desde el
repo local.

```bash
sudo nano /var/www/casa-origen/.env.production
```

Agregar al final:

```
TELEGRAM_BOT_TOKEN=<token nuevo>
TELEGRAM_CHAT_ID=8535525349
```

`deploy.sh` lo lee con `sed`, no con `source`: ese archivo tiene valores sin
comillas con espacios y `source` intentaría ejecutar la segunda palabra.

## 3. Probar que llega

```bash
curl -s -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id=8535525349 -d text=ok
```

Respuesta con `"ok":true` y el mensaje en el teléfono. Si vuelve
`"chat not found"`, falta apretarle **Start** al bot desde Telegram: un bot no
puede escribir primero.

## 4. Commit y push

Nada de esto corre hasta que `main` avance. El push dispara CI y, si queda
verde, el deploy real al cabo de ~20 min.

## Qué avisa (y qué no)

| Evento                          | Aviso                                          |
| ------------------------------- | ---------------------------------------------- |
| CI falla                        | ❌ rama, sha y link a la corrida               |
| Deploy OK                       | ✅ sha + subject del commit                    |
| Deploy falla, rollback repone   | ⚠️ sitio respondiendo                          |
| Deploy falla, sitio no responde | 🔥 revisar ya                                  |
| Deploy detenido (`die_loud`)    | 🚨 tree sucio, historias divergidas, sin disco |

Mudo a propósito: «CI still running» y «no CI run reported yet». Son estados
normales entre el push y el verde de Actions, y el timer corre cada 5 minutos —
una alerta que suena cada cinco minutos se silencia, y con ella se pierden las
que importan.
