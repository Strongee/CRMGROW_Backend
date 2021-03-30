const getAvatarName = (data) => {
  let { first_name, last_name } = data;
  const { full_name } = data;
  if (full_name) {
    first_name = full_name.split(' ')[0];
    last_name = full_name.split(' ')[1] || '';
  }
  return `${first_name.charAt(0)} ${last_name.charAt(0)}`;
};

module.exports = {
  getAvatarName,
};
