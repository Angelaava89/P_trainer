export const calcularTMB = ({ peso, altura, edad, sexo }) => {
  if (
    peso <= 0 ||
    altura <= 0 ||
    edad <= 0 ||
    !['masculino', 'femenino'].includes(sexo)
  ) {
    return null;
  }

  const base = (10 * peso) + (6.25 * altura) - (5 * edad);

  return Math.round(
    sexo === 'masculino' ? base + 5 : base - 161
  );
};

