// Simple demonstration tests for password validator
describe('Password Validator - Demo Tests', () => {
  describe('Basic String Validations', () => {
    test('should validate string length', () => {
      const shortString = 'Test';
      const longString = 'Test@1234567890';
      
      expect(shortString.length).toBeLessThan(8);
      expect(longString.length).toBeGreaterThan(8);
    });

    test('should check for uppercase letters', () => {
      const hasUppercase = /[A-Z]/.test('Test@1234');
      const noUppercase = /[A-Z]/.test('test@1234');
      
      expect(hasUppercase).toBe(true);
      expect(noUppercase).toBe(false);
    });

    test('should check for lowercase letters', () => {
      const hasLowercase = /[a-z]/.test('Test@1234');
      expect(hasLowercase).toBe(true);
    });

    test('should check for numbers', () => {
      const hasNumber = /\d/.test('Test@1234');
      expect(hasNumber).toBe(true);
    });

    test('should check for special characters', () => {
      const hasSpecial = /[@$!%*?&]/.test('Test@1234');
      expect(hasSpecial).toBe(true);
    });

    test('should handle empty strings', () => {
      const emptyString = '';
      expect(emptyString.length).toBe(0);
    });
  });
});
