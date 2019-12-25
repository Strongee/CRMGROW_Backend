const isBlockedEmail = (email) => {
  let mac = /^[a-z0-9](\.?[a-z0-9]){2,}@mac\.com$/;
  let me = /^[a-z0-9](\.?[a-z0-9]){2,}@me\.com$/;
  let icloud = /^[a-z0-9](\.?[a-z0-9]){2,}@icloud\.com$/;
  let yahoo = /^[a-z0-9](\.?[a-z0-9]){2,}@yahoo\.com$/;
  return mac.test(String(email).toLowerCase()) || me.test(String(email).toLowerCase()) || icloud.test(String(email).toLowerCase()) || yahoo.test(String(email).toLowerCase());
}

module.exports = {
  isBlockedEmail,
}