# 🔧 Solució Error: OperationError al KeyManager

## ❌ Problema

```
[KeyManager] [ERROR] Error recuperant clau mestra: OperationError
[KeyManager] [ERROR] Error desprotegint clau mestra: OperationError
```

Aquests errors passen durant l'**auto-save** perquè:

1. El sistema intenta encriptar les dades
2. Però la clau mestra està corrompuda o en format incorrecte
3. O la base de dades de claus (IndexedDB) té problemes

---

## ✅ SOLUCIÓ RÀPIDA: Netejar i Reiniciar

### Opció 1: Des de la Consola del Navegador (DevTools)

1. **Obre DevTools** (F12 o Ctrl+Shift+I)
2. **Ves a la pestanya Console**
3. **Executa això:**

```javascript
// Reseteja el sistema de claus
indexedDB.deleteDatabase("DietLogKeys");
indexedDB.deleteDatabase("DietLogDB");
localStorage.clear();
sessionStorage.clear();
location.reload();
```

4. **Refresca la pàgina** (F5)

---

### Opció 2: Des de Application/Storage

1. **Obre DevTools** (F12)
2. **Ves a Application** (Chrome) o **Storage** (Firefox)
3. **Navega a:**
   - `IndexedDB` → Esborra `DietLogKeys`
   - `IndexedDB` → Esborra `DietLogDB` (si vols començar de zero)
   - `Local Storage` → Esborra tot
   - `Session Storage` → Esborra tot
4. **Refresca** la pàgina

---

### Opció 3: Mode Incògnit (per provar sense perdre dades)

1. Obre el teu site en **finestra d'incògnit**
2. Prova d'escriure una dieta
3. Si funciona → el problema és la BD local
4. Si NO funciona → el problema és el codi

---

## 🛠️ SOLUCIÓ PERMANENT: Fix al Codi

El problema és que `getMasterKey()` **no valida** si la clau existeix abans de fer `unwrapMasterKey()`.

### Fix Necessari a `keyManager.js`:

```javascript
export async function getMasterKey() {
  try {
    // 1. Recuperar clau protegida
    const wrappedKeyArray = await getFromKeyStore(WRAPPED_KEY_ID);

    if (!wrappedKeyArray) {
      // ✅ FIX: Inicialitzar si no existeix
      log.warn("Clau mestra no trobada. Inicialitzant sistema...");
      await initializeKeySystem();
      return await getMasterKey(); // Retry després d'inicialitzar
    }

    // 2. Validar format
    if (!Array.isArray(wrappedKeyArray) || wrappedKeyArray.length === 0) {
      log.error("Clau mestra corrupta. Reinicialitzant...");
      await resetKeySystem();
      await initializeKeySystem();
      return await getMasterKey();
    }

    // 3. Convertir array a ArrayBuffer
    const wrappedKey = new Uint8Array(wrappedKeyArray).buffer;

    // 4. Derivar clau de dispositiu
    const deviceKey = await deriveDeviceKey();

    // 5. Desprotegir clau mestra (amb retry si falla)
    try {
      const masterKey = await unwrapMasterKey(wrappedKey, deviceKey);
      return masterKey;
    } catch (unwrapError) {
      log.error(
        "Error desprotegint clau. Format incorrecte o corrupta:",
        unwrapError
      );
      // Reinicialitzar sistema si unwrap falla
      await resetKeySystem();
      await initializeKeySystem();
      throw new Error(
        "Sistema de claus reinicialitzat. Si us plau, torna a provar."
      );
    }
  } catch (error) {
    log.error("Error recuperant clau mestra:", error);
    throw error;
  }
}
```

---

## ⚠️ PER QUÈ PASSA AIXÒ?

### Causes Possibles:

1. **Primera vegada** que uses l'app després d'afegir encriptació
2. **Canvi de navegador** o dispositiu (la device key és diferent)
3. **Neteja manual** de IndexedDB mentre desenvolupaves
4. **Format antic** de claus (si tenies una versió anterior)
5. **Bug en `wrapMasterKey`** que guarda mal el format

### Com Prevenir-ho:

1. ✅ **Validar format** abans de `unwrapMasterKey()`
2. ✅ **Auto-reinicialitzar** si la clau està corrupta
3. ✅ **Migració** de formats antics de claus
4. ✅ **Logging** més detallat per debug

---

## 🚨 IMPORTANT

### Si Tens Dades Encriptades:

- ⚠️ **NO executis `resetKeySystem()`** si tens dietes ja encriptades
- ⚠️ Les dades encriptades amb la clau antiga **seran irrecuperables**
- ✅ Abans de resetjar, **exporta les dietes** (si pots)

### Si És la Primera Vegada:

- ✅ **Resetja sense por** - no tens dades encriptades encara
- ✅ El sistema crearà una nova clau
- ✅ Totes les noves dietes s'encriptaran amb aquesta clau

---

## 🔍 Debug: Comprovar Estat

Executa això a la consola per veure l'estat:

```javascript
// Comprovar si existeix la BD de claus
indexedDB.databases().then((dbs) => {
  console.log("Bases de dades:", dbs);
});

// Comprovar contingut de la clau
(async () => {
  const openRequest = indexedDB.open("DietLogKeys", 1);
  openRequest.onsuccess = () => {
    const db = openRequest.result;
    const tx = db.transaction(["keys"], "readonly");
    const store = tx.objectStore("keys");
    const getRequest = store.get("wrapped-master-key");

    getRequest.onsuccess = () => {
      console.log("Clau guardada:", getRequest.result);
      console.log("És array?", Array.isArray(getRequest.result));
      console.log("Longitud:", getRequest.result?.length);
    };
  };
})();
```

---

**Data:** 2025-11-01  
**Tipus:** Bug en KeyManager - OperationError  
**Severitat:** 🔴 Alta (bloqueja auto-save)  
**Solució temporal:** Netejar IndexedDB  
**Solució permanent:** Validar format + auto-reinicialitzar
