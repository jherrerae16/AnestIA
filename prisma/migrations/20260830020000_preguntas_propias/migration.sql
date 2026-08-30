-- Preguntas propias del anestesiólogo, distinguidas de las del diccionario de la Especificación.
CREATE TYPE "OrigenPregunta" AS ENUM ('DICCIONARIO', 'PROPIA');
ALTER TABLE "Question" ADD COLUMN "origen" "OrigenPregunta" NOT NULL DEFAULT 'DICCIONARIO';
