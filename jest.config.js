module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '(src|shared)/.*\\.spec\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/client/'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // Transform ESM-only packages so Jest can handle them
  transformIgnorePatterns: [
    'node_modules/(?!(json-stringify-deterministic)/)',
  ],
  collectCoverageFrom: ['src/**/*.(t|j)s', 'shared/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  // Force exit after tests complete to avoid hanging processes from integration tests
  forceExit: true,
};
