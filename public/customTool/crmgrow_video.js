unlayer.registerPropertyEditor({
  name: 'material_content_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="player" name="material_field" value="player" class="material_field_type">
        <label for="player">Material Player</label><br>
        <input type="radio" id="title" name="material_field" value="title" class="material_field_type">
        <label for="title">Material Title</label><br>
        <input type="radio" id="description" name="material_field" value="description" class="material_field_type">
        <label for="description">Material Description</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('material_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].onChange = function(event) {
          updateValue(event.target.value);
        }
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'user_information_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="avatar" name="user_field" value="avatar" class="user_field_type">
        <label for="avatar">User Photo</label><br>
        <input type="radio" id="name" name="user_field" value="name" class="user_field_type">
        <label for="name">Username</label><br>
        <input type="radio" id="phone" name="user_field" value="phone" class="user_field_type">
        <label for="phone">User Phone number</label>
        <input type="radio" id="email" name="user_field" value="email" class="user_field_type">
        <label for="email">User email</label>
        <input type="radio" id="social" name="user_field" value="social" class="user_field_type">
        <label for="social">User Social Links</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('user_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].onChange = function(event) {
          updateValue(event.target.value);
        }
      }
    }
  })
});

unlayer.registerTool({
    name: 'my_tool',
    label: 'CRM Material',
    icon: 'fa-photo-video',
    supportedDisplayModes: ['web', 'email'],
    options: {
      fields: {
        title: "Material Fields",
        position: 1,
        options: {
          "materialField": {
            "label": "Material Field",
            "defaultValue": "player",
            "widget": "material_content_selector"
          }
        }
      },
      colors: {
        title: "Colors",
        position: 2,
        options: {
          "textColor": {
            "label": "Text Color",
            "defaultValue": "#FF0000",
            "widget": "color_picker"
          },
          "backgroundColor": {
            "label": "Background Color",
            "defaultValue": "#FF0000",
            "widget": "color_picker"
          }
        }
      },
      text: {
        title: "Text",
        position: 3,
        options: {
          "alignment": {
            "label": "Alignment",
            "defaultValue": "left",
            "widget": "alignment"
          },
          "font": {
            lable: "Font",
            "defaultValue": {
              label: 'Arial',
              value: 'arial,helvetica,sans-serif'
            },
            "widget": "font_family"
          }
        }
      }
    },
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

unlayer.registerTool({
  name: 'crm_user',
  label: 'Your Information',
  icon: 'fa-user',
  supportedDisplayModes: ['web', 'email'],
  options: {
    fields: {
      title: "Your Information Fields",
      position: 1,
      options: {
        "userField": {
          "label": "Your Information",
          "defaultValue": "name",
          "widget": "user_information_selector"
        }
      }
    },
    colors: {
      title: "Colors",
      position: 2,
      options: {
        "textColor": {
          "label": "Text Color",
          "defaultValue": "#FF0000",
          "widget": "color_picker"
        },
        "backgroundColor": {
          "label": "Background Color",
          "defaultValue": "#FF0000",
          "widget": "color_picker"
        }
      }
    },
    text: {
      title: "Text",
      position: 3,
      options: {
        "alignment": {
          "label": "Alignment",
          "defaultValue": "left",
          "widget": "alignment"
        },
        "font": {
          lable: "Font",
          "defaultValue": {
            label: 'Arial',
            value: 'arial,helvetica,sans-serif'
          },
          "widget": "font_family"
        }
      }
    }
  },
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