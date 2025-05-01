export const addressFormatter = (address) => {

    const addressOrder = [
        'house', 'street', 'landmark', 'loc',
        'vtc', 'po', 'subdist', 'dist', 'state', 'country'
    ];
    const addressParts = addressOrder
        .map(field => address[field])      // Fetch values from the address
        .filter(value => value !== null);  // Remove null/undefined values

    // Join parts with commas
    const combinedAddress = addressParts.join(', ');
    return combinedAddress;
}
