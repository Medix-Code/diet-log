// Classe per representar una dieta amb les seves dades
export class Diet {
  // Constructor per crear una dieta
  constructor({
    id = "",
    date = "",
    dietType = "",
    vehicleNumber = "",
    person1 = "",
    person2 = "",
    signatureConductor = "",
    signatureAjudant = "",
    services = [], // Assegura que és un array per defecte
    serviceType = "TSU",
    timeStampDiet = new Date().toISOString(),
  } = {}) {
    // ID únic de la dieta
    this.id = String(id);

    // Data de la dieta
    this.date = String(date);

    // Tipus de dieta (lunch, dinner, etc.)
    this.dietType = String(dietType);

    // Número del vehicle
    this.vehicleNumber = String(vehicleNumber);

    // Nom del conductor
    this.person1 = String(person1);

    // Nom de l'ajudant
    this.person2 = String(person2);

    // Signatura del conductor
    this.signatureConductor = String(signatureConductor);

    // Signatura de l'ajudant (si cal)
    this.signatureAjudant = String(signatureAjudant);

    // Llista de serveis relacionats
    this.services = Array.isArray(services) ? services : [];

    // Tipus de servei (TSU, TSNU, etc.)
    this.serviceType = String(serviceType);

    // Quan es va desar la dieta
    this.timeStampDiet = String(timeStampDiet);
  }
}
