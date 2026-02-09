# Despliegue (Coolify / Docker)

## Por qué desaparecen las imágenes en Media después de cada push

**No es un fallo de la página Media.** Las imágenes se guardan en `public/uploads/` dentro del contenedor. Eso implica:

1. **`public/uploads/` está en `.gitignore`** → no se sube al repo ni se incluye en la imagen Docker.
2. **Cada despliegue** (nuevo build → nuevo contenedor) arranca con el sistema de archivos “limpio”: la carpeta de subidas está vacía.
3. Por eso solo ves las imágenes que subes **después** de ese despliegue; las anteriores se “pierden” porque vivían en el contenedor anterior.

## Solución: volumen persistente en Coolify

Hay que hacer que la carpeta de subidas **persista entre despliegues** montando un volumen.

### En Coolify

1. Entra en tu **servicio** (esta app).
2. Abre la sección **Storage / Volumes / Persistent Storage** (o similar).
3. Añade un **mount**:
   - **Ruta en el contenedor:** `/app/public/uploads`
   - **Volumen:** crea uno nuevo o elige uno existente (por ejemplo `fb-panel-uploads`).

Así, todo lo que se guarde en `/app/public/uploads` (las imágenes subidas desde el panel y desde `/api/media/upload-base64`) se mantendrá aunque hagas push y se redepliegue el contenedor.

### Comprobación

- Sube una imagen desde el panel (Media o publicaciones).
- Haz un nuevo deploy (push).
- Vuelve a entrar en Media: la imagen debería seguir apareciendo.

### Si usas Docker Compose u otro orquestador

Monta el mismo directorio en el contenedor:

```yaml
volumes:
  - uploads_data:/app/public/uploads
```

Y declara el volumen nombrado:

```yaml
volumes:
  uploads_data:
```

Con esto, las imágenes de Media dejan de “borrarse” en cada push.
