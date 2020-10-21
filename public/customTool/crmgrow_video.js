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
          return "<div>I am a custom tool Editor UI.</div>"
        }
      }),
      exporters: {
        web: function(values) {
          return "<div>I am a custom tool Exporter WEB.</div>"
        },
        email: function(values) {
          return "<div>I am a custom tool Email Exporter.</div>"
        }
      },
      head: {
        css: function(values) {},
        js: function(values) {}
      }
    }
  });