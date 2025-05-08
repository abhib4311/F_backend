const getAge = (dob) => {
  if (!dob) return null; // If DOB is missing, return null

  const birthDate = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();

  // Adjust age if the birthday hasn't occurred this year yet
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};

export default getAge;