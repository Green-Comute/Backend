const isStrongPassword = (password) => {
    // At least:
    // 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  
    return strongRegex.test(password);
  };
  
  export default isStrongPassword;