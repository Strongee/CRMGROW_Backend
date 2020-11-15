unlayer.registerPropertyEditor({
  name: 'material_content_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="player" name="material_field" value="player" class="material_field_type" ${value=='player' ? 'checked' : ''}>
        <label for="player">Material Player</label><br>
        <input type="radio" id="title" name="material_field" value="title" class="material_field_type" ${value=='title' ? 'checked' : ''}>
        <label for="title">Material Title</label><br>
        <input type="radio" id="description" name="material_field" value="description" class="material_field_type" ${value=='description' ? 'checked' : ''}>
        <label for="description">Material Description</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('material_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'font_size_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <label for="font-size" style="font-size: 12px;
          color: rgb(143, 150, 153);
          font-weight: 600;">Font Size</label>
        <input type="number" id="font-size" value="${value}" defaultValue="16" class="font-size-input" style="float: right; width: 50px;"/>
      `
    },
    mount(node, value, updateValue, data) {
      var input = node.getElementsByClassName('font-size-input')[0];
      input.onchange = function(event) {
        updateValue(event.target.value);
      };
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'size_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <label for="font-size" style="font-size: 12px;
          color: rgb(143, 150, 153);
          font-weight: 600;">Avatar Size</label>
        <input type="number" id="avatar-size" value="${value}" defaultValue="60" class="avatar-size-input" style="float: right; width: 60px;"/>
      `
    },
    mount(node, value, updateValue, data) {
      var input = node.getElementsByClassName('avatar-size-input')[0];
      input.onchange = function(event) {
        updateValue(event.target.value);
      };
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'user_information_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="avatar" name="user_field" value="avatar" class="user_field_type" ${value=='avatar' ? 'checked' : ''}>
        <label for="avatar">User Photo</label><br>
        <input type="radio" id="name" name="user_field" value="name" class="user_field_type" ${value=='name' ? 'checked' : ''}>
        <label for="name">Username</label><br>
        <input type="radio" id="phone" name="user_field" value="phone" class="user_field_type" ${value=='phone' ? 'checked' : ''}>
        <label for="phone">User Phone number</label><br>
        <input type="radio" id="email" name="user_field" value="email" class="user_field_type" ${value=='email' ? 'checked' : ''}>
        <label for="email">User email</label><br>
        <input type="radio" id="social" name="user_field" value="social" class="user_field_type" ${value=='social' ? 'checked' : ''}>
        <label for="social">User Social Links</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('user_field_type')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
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
            "defaultValue": "#000",
            "widget": "color_picker"
          },
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
            label: "Font",
            "defaultValue": {
              label: 'Arial',
              value: 'arial,helvetica,sans-serif'
            },
            "widget": "font_family"
          },
          "fontSize": {
            label: "Font Size",
            defaultValue: 16,
            "widget": 'font_size_selector'
          }
        }
      }
    },
    values: {},
    renderer: {
      Viewer: unlayer.createViewer({
        render(values) {
          let html = ''
          switch(values.materialField) {
            case 'player':
              html = `
                <div style="height: 200px;
                  background: gainsboro;
                  border-radius: 5px;
                  border: 3px dashed gray;
                  font-size: 18px;
                  text-align: center;
                  color: #848484;
                  padding: 40px 90px;">
                  MATERIAL(VIDEO, PDF, IMAGE) Viewer will be placed here.
                </div>
              `;
              break;
            case 'title':
              html = `
              <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}">
                Material Title would be here.
              </div>
              `;
              break;
            case 'description':
              html = `
              <div style="color: ${values.textColor}; text-align: ${values.alignment}; font-family: ${values.font.value};">
                Material Description would be here.
              </div>
              `;
              break;
            default:
              html = `
              <div style="height: 200px;
                background: gainsboro;
                border-radius: 5px;
                border: 3px dashed gray;
                font-size: 20px;
                text-align: center;
                color: #848484;
                padding: 40px 90px;">
                MATERIAL(VIDEO, PDF, IMAGE) will be placed here.
              </div>
              `
          }
          return html;
        }
      }),
      exporters: {
        web: function(values) {
          let html = ''
          switch(values.materialField) {
            case 'player':
              html = `
                <div style="height: 200px;
                  background: gainsboro;
                  border-radius: 5px;
                  border: 3px dashed gray;
                  font-size: 18px;
                  text-align: center;
                  color: #848484;
                  padding: 40px 90px;" class="unlayer-material-viewer">
                  MATERIAL(VIDEO, PDF, IMAGE) Viewer will be placed here.
                </div>
              `;
              break;
            case 'title':
              html = `
              <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="unlayer-material-title">
                Material Title would be here.
              </div>
              `;
              break;
            case 'description':
              html = `
              <div style="color: ${values.textColor}; text-align: ${values.alignment}; font-family: ${values.font.value};" class="unlayer-material-description">
                Material Description would be here.
              </div>
              `;
              break;
            default:
              html = `
              <div style="height: 200px;
                background: gainsboro;
                border-radius: 5px;
                border: 3px dashed gray;
                font-size: 20px;
                text-align: center;
                color: #848484;
                padding: 40px 90px;" class="unlayer-material">
                MATERIAL(VIDEO, PDF, IMAGE) will be placed here.
              </div>
              `
          }
          return html;
        },
        email: function(values) {
          let html = ''
          switch(values.materialField) {
            case 'player':
              html = `
                <div style="height: 200px;
                  background: gainsboro;
                  border-radius: 5px;
                  border: 3px dashed gray;
                  font-size: 18px;
                  text-align: center;
                  color: #848484;
                  padding: 40px 90px;" class="unlayer-material-viewer">
                  MATERIAL(VIDEO, PDF, IMAGE) Viewer will be placed here.
                </div>
              `;
              break;
            case 'title':
              html = `
              <div style="
                color: ${values.textColor};
                background-color: ${values.backgroundColor};
                font-family: ${values.font.value}; font-size: ${values.fontSize}px;" class="unlayer-material-title">
                Material Title would be here.
              </div>
              `;
              break;
            case 'description':
              html = `
              <div style="
                color: ${values.textColor};
                background-color: ${values.backgroundColor};
                font-family: ${values.font.value};" class="unlayer-material-description">
                Material Description would be here.
              </div>
              `;
              break;
            default:
              html = `
              <div style="height: 200px;
                background: gainsboro;
                border-radius: 5px;
                border: 3px dashed gray;
                font-size: 20px;
                text-align: center;
                color: #848484;
                padding: 40px 90px;" class="unlayer-material">
                MATERIAL(VIDEO, PDF, IMAGE) will be placed here.
              </div>
              `
          }
          return html;
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
    block: {
      title: "Size",
      position: 2,
      options: {
        "blockSize": {
          "label": "Size",
          "defaultValue": "60",
          "widget": "size_selector"
        }
      }
    },
    colors: {
      title: "Colors",
      position: 3,
      options: {
        "textColor": {
          "label": "Text Color",
          "defaultValue": "#000",
          "widget": "color_picker"
        }
      }
    },
    text: {
      title: "Text",
      position: 4,
      options: {
        "alignment": {
          "label": "Alignment",
          "defaultValue": "left",
          "widget": "alignment"
        },
        "font": {
          label: "Font",
          "defaultValue": {
            label: 'Arial',
            value: 'arial,helvetica,sans-serif'
          },
          "widget": "font_family"
        },
        "fontSize": {
          label: "Font Size",
          defaultValue: 16,
          "widget": 'font_size_selector'
        }
      }
    }
  },
  values: {},
  renderer: {
    Viewer: unlayer.createViewer({
      render(values) {
        let html = ''
        switch(values.userField) {
          case 'avatar':
            html = `
              <div style="height: ${values.blockSize}px; width: ${values.blockSize}px; border-radius: 50%; box-shadow: 3px 3px 10px #0004; overflow: hidden;">
                
              </div>
            `;
            break;
          case 'name':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};">
              Your Name
            </div>
            `;
            break;
          case 'phone':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};">
              Your Phone Number
            </div>
            `;
            break;
          case 'email':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};">
              Your Email
            </div>
            `;
            break;
          case 'social_links':
            html = `
            <div>
              Social Links Here             
            </div>
            `;
            break;
        }
        return html;
      }
    }),
    exporters: {
      web: function(values) {
        let html = ''
        switch(values.userField) {
          case 'avatar':
            html = `
              <div class="your-avatar-field" style="height: ${values.blockSize}px; width: ${values.blockSize}px; border-radius: 50%; box-shadow: 3px 3px 10px #0004; overflow: hidden;">
                
              </div>
            `;
            break;
          case 'name':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="your-name-field">
              Your Name
            </div>
            `;
            break;
          case 'phone':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="your-phone-field">
              Your Phone Number
            </div>
            `;
            break;
          case 'email':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="your-email-field">
              Your Email
            </div>
            `;
            break;
          case 'social_links':
            html = `
            <div class="your-social-field">
              Social Links Here             
            </div>
            `;
            break;
        }
        return html;
      },
      email: function(values) {
        let html = ''
        switch(values.materialField) {
          case 'avatar':
            html = `
              <div class="your-avatar-field" style="height: ${values.blockSize}px; width: ${values.blockSize}px; border-radius: 50%; box-shadow: 3px 3px 10px #0004; overflow: hidden;">
                
              </div>
            `;
            break;
          case 'name':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="your-name-field">
              Your Name
            </div>
            `;
            break;
          case 'phone':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="your-phone-field">
              Your Phone Number
            </div>
            `;
            break;
          case 'email':
            html = `
            <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment}; font-family: ${values.font.value};" class="your-email-field">
              Your Email
            </div>
            `;
            break;
          case 'social_links':
            html = `
            <div class="your-social-field">
              Social Links Here             
            </div>
            `;
            break;
        }
        return html;
      }
    },
    head: {
      css: function(values) {},
      js: function(values) {}
    }
  }
});