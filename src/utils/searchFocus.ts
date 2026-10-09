let pending = false;

export const requestSearchFocus = () => {
  pending = true;
};

export const consumeSearchFocus = () => {
  const wasPending = pending;
  pending = false;
  return wasPending;
};
