unlayer.registerTool({
    name: 'my_tool',
    label: 'My Tool',
    icon: 'fa-photo-video',
    supportedDisplayModes: ['web', 'email'],
    options: {},
    values: {},
    renderer: {
      Viewer: unlayer.createViewer({
        render(values) {
          return `
          <div style="height: 200px;
            background: gainsboro;
            border-radius: 5px;
            border: 3px dashed gray;
            margin: -10px;
            font-size: 20px;
            text-align: center;
            color: #848484;
            padding: 40px 90px;">
            MATERIAL(VIDEO, PDF, IMAGE) will be placed here.
          </div>
          `
        }
      }),
      exporters: {
        web: function(values) {
          return `<div class="material-wrapper">{{material_content}}</div>`
        },
        email: function(values) {
          return `<div class="material-wrapper">{{material_content}}</div>`
        }
      },
      head: {
        css: function(values) {},
        js: function(values) {}
      }
    }
  });