const getURL = () => {
    let URL;
    if (process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      URL = 'http://localhost:3000/api';
    } else {
      URL = 'https://teamgrow.co/api';
    }
    console.log('getURL', process.env.NODE_ENV, URL);
    return URL;
  };
  
  export const API_URL = getURL();
  export const EMAIL_AUTHORIZE_URL = `${API_URL}/user/authorize-outlook`