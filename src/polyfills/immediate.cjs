module.exports = function immediate(task, ...args) {
  setTimeout(() => {
    task(...args);
  }, 0);
};
