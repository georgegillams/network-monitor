const simpleFetch = async (url) => {
  const response = await fetch(url);
  const text = await response.text();
  return text;
};

const getTimestampString = () => {
  return new Date().toISOString();
};

module.exports = { simpleFetch, getTimestampString };
