# Carpeta del modelo

Coloca aquí el modelo entrenado con el nombre exacto:

```
EfficientNetB0_best.keras
```

Ruta completa esperada por el backend:

```
backend/model/EfficientNetB0_best.keras
```

> El fichero (~29 MB) está excluido de git mediante `.gitignore`.
> El backend lo carga **una sola vez al arrancar**. Si no existe, `/health`
> devolverá `model_loaded: false` y `/predict` responderá 503.
