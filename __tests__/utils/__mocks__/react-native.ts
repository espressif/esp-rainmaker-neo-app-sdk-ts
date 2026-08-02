// Mock React Native for integration tests
export const Platform = {
  OS: "ios",
  select: (obj: any) => obj.ios || obj.default,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 667 }),
};

export default {
  Platform,
  Dimensions,
};
