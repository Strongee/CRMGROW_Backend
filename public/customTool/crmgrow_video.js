unlayer.registerPropertyEditor({
  name: 'material_content_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="block" name="material_field" value="block" class="material_field_type" ${value=='block' ? 'checked' : ''}>
        <label for="block">Material Block</label><br>
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
  name: 'material_fields_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="checkbox" id="player_field" name="material_field_sel" value="player" class="show_material_field" ${!value.player ? 'checked' : ''}>
        <label for="player_field">Material Player</label><br>
        <input type="checkbox" id="title_field" name="material_field_sel" value="title" class="show_material_field" ${!value.title ? 'checked' : ''}>
        <label for="title_field">Material Title</label><br>
        <input type="checkbox" id="description_field" name="material_field_sel" value="description" class="show_material_field" ${!value.description ? 'checked' : ''}>
        <label for="description_field">Material Description</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('show_material_field')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          const updatedValue = value;
          updatedValue[event.target.value] = !updatedValue[event.target.value];
          updateValue(updatedValue);
        })
      }
    }
  })
});

const MATERIAL_BLOCKS = [
  {value: 'layout1', label: 'Layout 1', img: ''},
  {value: 'layout2', label: 'Layout 2', img: ''},
  {value: 'layout3', label: 'Layout 3', img: ''},
  {value: 'layout4', label: 'Layout 4', img: ''},
]

unlayer.registerPropertyEditor({
  name: 'material_layout_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      let html = ``;
      MATERIAL_BLOCKS.forEach(e => {
        let layout =  `<input type="radio" id="ml_${e.value}" name="material_layout" value="${e.value}" class="material_layout" ${value === e.value ? 'checked' : ''}>
        <label for="ml_${e.value}">${e.label}</label><br>`;
        html += layout;
      })
      return html;
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('material_layout')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          updateValue(event.target.value);
        })
      }
    }
  })
});

unlayer.registerPropertyEditor({
  name: 'user_information_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="radio" id="profileBlock" name="user_field" value="profileBlock" class="user_field_type" ${value=='profileBlock' ? 'checked' : ''}>
        <label for="profileBlock">User Block</label><br>
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

unlayer.registerPropertyEditor({
  name: 'user_field_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      return `
        <input type="checkbox" id="avatar_field" name="user_field_sel" value="avatar" class="show_user_field" ${!value.avatar ? 'checked' : ''}>
        <label for="avatar_field">User Photo</label><br>
        <input type="checkbox" id="name_field" name="user_field_sel" value="name" class="show_user_field" ${!value.name ? 'checked' : ''}>
        <label for="name_field">Username</label><br>
        <input type="checkbox" id="phone_field" name="user_field_sel" value="phone" class="show_user_field" ${!value.phone ? 'checked' : ''}>
        <label for="phone_field">User Phone number</label><br>
        <input type="checkbox" id="email_field" name="user_field_sel" value="email" class="show_user_field" ${!value.email ? 'checked' : ''}>
        <label for="email_field">User email</label><br>
        <input type="checkbox" id="social_field" name="user_field_sel" value="social" class="show_user_field" ${!value.social ? 'checked' : ''}>
        <label for="social_field">User Social Links</label>
      `
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('show_user_field')
      for (var i = 0; i < radios.length; i++) {
        radios[i].addEventListener('change', function(event) {
          const updatedValue = value;
          updatedValue[event.target.value] = !updatedValue[event.target.value];
          updateValue({...updatedValue});
        });
      }
    }
  })
});


const PROFILE_BLOCKS = [
  {value: 'layout1', label: 'Layout 1', img: ''},
  {value: 'layout2', label: 'Layout 2', img: ''},
  {value: 'layout3', label: 'Layout 3', img: ''},
  {value: 'layout4', label: 'Layout 4', img: ''},
]

unlayer.registerPropertyEditor({
  name: 'profile_layout_selector',
  Widget: unlayer.createWidget({
    render(value, updateValue, data) {
      let html = ``;
      PROFILE_BLOCKS.forEach(e => {
        let layout =  `<input type="radio" id="pl_${e.value}" name="profile_layout" value="${e.value}" class="profile_layout" ${value === e.value ? 'checked' : ''}>
        <label for="ml_${e.value}">${e.label}</label><br>`;
        html += layout;
      })
      return html;
    },
    mount(node, value, updateValue, data) {
      var radios = node.getElementsByClassName('profile_layout')
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
      layouts: {
        title: "Material Blocks",
        position: 2,
        options: {
          "materialLayout": {
            label: "Material Layout",
            defaultValue: "layout1",
            widget: "material_layout_selector"
          },
          "layoutFields": {
            lable: "Layout Contents",
            defaultValue: {},
            widget: "material_fields_selector"
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
              <div style="color: ${values.textColor}; font-size: ${values.fontSize}px; text-align: ${values.alignment};">
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
                font-family: ${values.font.value}; font-size: ${values.fontSize}px; text-align: ${values.alignment};" class="unlayer-material-title">
                Material Title would be here.
              </div>
              `;
              break;
            case 'description':
              html = `
              <div style="
                color: ${values.textColor};
                background-color: ${values.backgroundColor};
                font-family: ${values.font.value}; text-align: ${values.alignment};" class="unlayer-material-description">
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

function getProfileLayoutHTML(layout, layoutFields) {
  return `<div>${JSON.stringify(layout)}, ${JSON.stringify(layoutFields)}</div>`
}

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
    layouts: {
      title: "Your Information Blocks",
      position: 2,
      options: {
        "profileLayout": {
          label: "Profile Layout",
          defaultValue: "layout1",
          widget: "profile_layout_selector"
        },
        "layoutFields": {
          lable: "Layout Contents",
          defaultValue: {},
          widget: "user_field_selector"
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
        console.log("udpate values", values);
        switch(values.userField) {
          case 'profileBlock':
            const layout = values.profileLayout;
            const layoutFields = values.layoutFields;
            html = getProfileLayoutHTML(layout, layoutFields);
            break;
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
          default:
            html = '';
        }
        return html;
      }
    }),
    exporters: {
      web: function(values) {
        let html = ''
        switch(values.userField) {
          case 'profileBlock':
            let layout = values.profileLayout;
            let layoutFields = values.layoutFields;
            html = getProfileLayoutHTML(layout, layoutFields);
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
          default:
            html = '';
        }
        console.log("Web USER HTML", html, values);
        return html;
      },
      email: function(values) {
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
          default:
            html = '';
        }
        console.log("Email USER HTML", html, values);
        return html;
      }
    },
    head: {
      css: function(values) {},
      js: function(values) {}
    }
  }
});