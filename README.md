# Diet Log

Una herramienta para registrar horarios y detalles de servicios, generar informes PDF y agilizar la gestión de dietas.

## Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Tecnologías Utilizadas](#tecnologías-utilizadas)
- [Instalación](#instalación)
- [Uso](#uso)
- [Contribuciones](#contribuciones)
- [Licencia](#licencia)
- [Contacto](#contacto)

## Descripción

**Diet Log** es una aplicación diseñada para facilitar la gestión de dietas y horarios de servicios. Permite a los usuarios registrar detalles de sus dietas, generar informes en formato PDF y mantener un control eficiente sobre sus actividades diarias. La herramienta está pensada para simplificar el seguimiento y la organización, asegurando que toda la información relevante esté siempre accesible y bien documentada.

## Características

- **Registro de Servicios**: Permite agregar, actualizar y eliminar horarios y detalles de servicios de manera sencilla.
- **Generación de Informes PDF**: Genera informes detallados en formato PDF que incluyen toda la información registrada.
- **Gestión de Firmas**: Facilita la incorporación de firmas digitales para validar y confirmar los registros.
- **Validaciones Automáticas**: Asegura la integridad de los datos mediante validaciones de formatos y coherencia temporal.
- **Interfaz Intuitiva**: Diseñada para ser fácil de usar, con una interfaz clara y accesible para todos los usuarios.
- **Almacenamiento Local**: Utiliza IndexedDB para el almacenamiento seguro de la información en el navegador.

## Tecnologías Utilizadas

- **JavaScript**: Lenguaje principal para la lógica de la aplicación.
- **IndexedDB**: Para el almacenamiento local de datos.
- **PDFLib**: Biblioteca utilizada para la generación de informes en PDF.
- **HTML & CSS**: Para la estructura y el estilo de la interfaz de usuario.

## Instalación

### Requisitos Previos

- **Navegador Moderno**: La aplicación funciona mejor en navegadores recientes como Chrome, Firefox o Edge.
- **Servidor Local**: Para servir los archivos de la aplicación. Puedes usar herramientas como [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) en VSCode.

### Pasos de Instalación

1. **Clonar el Repositorio, Navegar al Directorio, Instalar Dependencias e Iniciar el Servidor Local**

```bash
git clone https://github.com/***/diet-log.git
cd diet-log
npm install # o yarn install
npm start # o yarn start
```

2. **Acceder a la Aplicación**

Abre tu navegador y navega a http://localhost:3000 (o el puerto especificado).

## Uso

### Registrar un Servicio

- Navega a la sección de servicios.
- Haz clic en "Agregar Servicio".
- Completa los campos requeridos, como número de servicio, origen, destino y horarios.
- Guarda el servicio para que se registre en la base de datos.

### Generar Informe PDF

- Una vez hayas registrado todos los servicios necesarios, ve a la sección de informes.
- Haz clic en "Generar PDF".
- El informe se generará automáticamente y podrás descargarlo.

### Gestionar Firmas

- En la sección de configuración, puedes agregar firmas digitales para el conductor y el ayudante.
- Usa el lienzo de firma para dibujar y guardar tus firmas.

### Validaciones

- La aplicación validará automáticamente los datos introducidos para asegurar que cumplen con el formato y la coherencia temporal requeridos.

## Contribuciones

¡Las contribuciones son bienvenidas! Si deseas contribuir a Diet Log, sigue estos pasos:

- Haz un _fork_ del repositorio.
- Crea una rama para tu _feature_ o _bugfix_ (`git checkout -b feature/nueva-funcionalidad`).
- Haz _commit_ de tus cambios (`git commit -m 'Agregar nueva funcionalidad'`).
- Haz _push_ a la rama (`git push origin feature/nueva-funcionalidad`).
- Abre un _Pull Request_ describiendo tus cambios.

Por favor, asegúrate de seguir las normas de codificación y realizar pruebas antes de enviar tus contribuciones.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.

## Contacto

Si tienes alguna pregunta, sugerencia o comentario, no dudes en contactarnos:

- GitHub: user

---
