import {
  SkillBuilders,
  getRequestType,
  getIntentName,
  getSlot,
  HandlerInput,
  RequestHandler,
  ErrorHandler
} from "ask-sdk-core";
import fetch from "node-fetch";

const APILink = "https://alexa-conecta.herokuapp.com/api";

const APP_STATE = "app-state";
const SELECTED_PROGRAM = "current-program";
const SELECTED_PROJECT = "current-project";

enum APP_STATES {
  START = 0,
  PROGRAMS_QUERY_START = 1,
  SINGLE_PROGRAM_QUERY = 2,
  PROGRAM_INTEREST_QUERY = 3,
  PROJECT_START = 4,
  PROJECTS_LISTING = 5,
  SINGLE_PROJECT_QUERY = 6,
  SINGLE_PROJECT_QUERY_ENDED = 7,
  PROGRAM_TO_PROJECT_SWITCH = 8
}

/////////////////////////////
//  Funciones de utilidad  //
/////////////////////////////
/**
 * Regresa el estado actual de la aplicacion
 * @param inputHandler el manejador del request para un intent
 */
function getCurrentAppState(inputHandler: HandlerInput): APP_STATES {
  return inputHandler.attributesManager.getSessionAttributes()[APP_STATE];
}
/**
 * Regresa el programa al que se pregunto recientemente
 * @param inputHandler el manejador del request para un intent
 */
function getCurrentProgramState(inputHandler: HandlerInput) {
  return inputHandler.attributesManager.getSessionAttributes()[
    SELECTED_PROGRAM
  ];
}
/**
 * Regresa el proyecto al que se pregunto recientemente
 * @param inputHandler el manejador del request para un intent
 */
function getCurrentProject(inputHandler: HandlerInput) {
  return inputHandler.attributesManager.getSessionAttributes()[
    SELECTED_PROJECT
  ];
}
/**
 * Funcion que cambia el proyecto al que se le pregunto al Alexa
 * @param inputHandler el manejador del request para un intent
 * @param programName el nombre del proyecto
 */
function setCurrentProject(inputHandler: HandlerInput, projectName: string) {
  const { attributesManager } = inputHandler;
  const prevSession = attributesManager.getSessionAttributes();
  prevSession[SELECTED_PROJECT] = projectName;
  attributesManager.setSessionAttributes(prevSession);
}
/**
 * Funcion que cambia el estado de la session estado del Alexa
 * @param inputHandler el manejador del request para un intent
 * @param state el estado al que se quiere cambiar
 */
function setCurrentAppState(inputHandler: HandlerInput, state: APP_STATES) {
  const { attributesManager } = inputHandler;
  const prevSession = attributesManager.getSessionAttributes();
  prevSession[APP_STATE] = state;
  attributesManager.setSessionAttributes(prevSession);
}
/**
 * Funcion que cambia el programa al que se le pregunto al Alexa
 * @param inputHandler el manejador del request para un intent
 * @param programName el nombre del programa
 */
function setCurrentProgramQueryState(
  inputHandler: HandlerInput,
  programName: string
) {
  const { attributesManager } = inputHandler;
  const prevSession = attributesManager.getSessionAttributes();
  prevSession[SELECTED_PROGRAM] = programName;
  attributesManager.setSessionAttributes(prevSession);
}
//////////////////////////////
//////////////////////////////

// interfaz de la info que deberia tener un proyecto para un programa dado
interface Proyecto {
  name: string;
  description: string;
  members: Array<string>;
  // el stage es el nombre programa al que pertenece
  currentStage: string;
}

/**
 * Intent del lanzamiento del Alexa
 */
const LaunchRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  handle(handlerInput) {
    setCurrentAppState(handlerInput, APP_STATES.START);

    const speakOutput =
      "¡Hola! Bienvenido a la Zona Ei. Estoy aquí para apoyarte a conocer más sobre \
      programas de emprendimiento en el Tec y sus proyectos participantes. \
      ¿Qué deseas saber?";
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

/**
 * Manejdador de intent para saber acerca de los programas
 * No tiene verificacion de estado (APP_STATES), para que sea accesible desde cualquier parte de la interaccion
 */
const ProgramasEntryIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "programasEntry"
    );
  },
  async handle(handlerInput) {
    setCurrentAppState(handlerInput, APP_STATES.PROGRAMS_QUERY_START);

    const speakOutput = `Existen 3 programas para emprendedores, \
    los cuáles te pueden ayudar a validar. \
    desarrollar. o crecer tu idea de negocio. \
    ¿Cuál de las 3 opciones de gustaría explorar? `;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

/**
 * Manejador de intent para cuando el usuario quiera saber informacion de los proyectos relacionados a un programa, luego del intent de Informacion
 * Se ejecuta en lugar del proyectosEntry, se utilizan los mismos utterances (quiero saber de proyectos, dime de proyectos, que proyectos son)
 */
const InformationSwitchHandler: RequestHandler = {
  canHandle(handlerInput) {
    const currentState = getCurrentAppState(handlerInput);
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "proyectosEntry" &&
      currentState === APP_STATES.PROGRAM_TO_PROJECT_SWITCH
    );
  },
  async handle(handlerInput) {
    // recuperar el nombre del programa que antes se pidio
    const program = getCurrentProgramState(handlerInput);

    let intentOutput = "";
    let data, dataJSON;

    // conseguir datos del api,
    // el nombre del slot es    Tec Lean X,
    // en la base  de datos es           X,
    // quitar el Tec Lean
    data = await fetch(
      `${APILink}/project/stage?stage=${program?.replace("Tec Lean ", "")}`
    );
    dataJSON = await data.json();
    // si hay proyectos
    if (dataJSON !== null && dataJSON.length > 0) {
      // si es solo 1 proyecto
      if (dataJSON.length === 1) {
        intentOutput += `Para el programa ${program} tenemos a ${dataJSON[0].program}`;
      }
      // son varios proyectos
      else {
        // generar una lista de los proyectos de manera:
        // Para el programa Tec Lean Discover tenemos a los proyectos: A, B, C.
        intentOutput += `Para el programa ${program} tenemos a los proyectos: \
              ${dataJSON
                .map((proyecto: Proyecto) => proyecto.name)
                .join(", ")}. `;
      }
      intentOutput += "¿Te interesa conocer más de alguno de los proyectos?";
    } else {
      intentOutput = "No tenemos proyectos relacionados a este programa. ";
    }

    return handlerInput.responseBuilder
      .speak(intentOutput)
      .reprompt(intentOutput)
      .getResponse();
  }
};

/**
 * Manejador de intent para cuando el usuario quiere la informacion de un proyecto o de un programa
 * Ejecuta los queries para sacar los datos de un programa o proyecto de la base de datos
 */
const InformationIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "Information"
    );
  },
  async handle(handlerInput) {
    // nombre del programa que se pidio
    const programName = getSlot(handlerInput.requestEnvelope, "programaName");
    // estado actual del programa
    const currentState = getCurrentAppState(handlerInput);
    let intentOutput = "";

    // nombre del slot
    const name =
      programName.resolutions?.resolutionsPerAuthority?.[0].values[0].value
        .name;

    let data, dataJSON;

    // si se quiere saber de programas (esta en un estado relacionado a programas)
    if (
      currentState === APP_STATES.PROGRAMS_QUERY_START ||
      currentState === APP_STATES.PROGRAM_INTEREST_QUERY ||
      currentState === APP_STATES.SINGLE_PROGRAM_QUERY
    ) {
      // Tomar informacion del programa de la base de datos
      data = await fetch(`${APILink}/program/name?name=${name}`);
      dataJSON = await data.json();
      // si no regreso nada o fallo al convertir los datos, decir que no pudo encontrar info
      if (dataJSON !== null) {
        intentOutput += `El programa ${name} ${dataJSON.description}. \
              ¿Te interesa saber cómo inscribirte, O \
              Te gustaría conocer los proyectos inscritos al programa?`;
        // cambiar programa preguntado a el nombre del programa
        setCurrentProgramQueryState(handlerInput, String(name));
      } else {
        intentOutput = "No tengo información de este programa. ";
      }
      // setear estado a que puede hacer el switch dependiendo de lo que responda el usuario
      // permite que se entre al intent del switch
      setCurrentAppState(handlerInput, APP_STATES.PROGRAM_TO_PROJECT_SWITCH);
    } else {
      // conseguir datos del api,
      // el nombre del slot es    Tec Lean X,
      // en la base  de datos es           X,
      // quitar el Tec Lean
      data = await fetch(
        `${APILink}/project/stage?stage=${name?.replace("Tec Lean ", "")}`
      );
      dataJSON = await data.json();
      // si hay proyectos
      if (dataJSON !== null && dataJSON.length > 0) {
        // si es solo 1 proyecto
        if (dataJSON.length === 1) {
          intentOutput += `Para el programa ${name} tenemos a ${dataJSON[0].program}`;
        }
        // son varios proyectos
        else {
          // generar una lista de los proyectos de manera:
          // Para el programa Tec Lean Discover tenemos a los proyectos: A, B, C.
          intentOutput += `Para el programa ${name} tenemos a los proyectos: \
                ${dataJSON
                  .map((proyecto: Proyecto) => proyecto.name)
                  .join(", ")}. `;
        }
        intentOutput += "¿Te interesa conocer más de alguno de los proyectos?";
      } else {
        intentOutput = "No tenemos proyectos relacionados a este programa. ";
      }
      // set el estado a que sea el listado de los proyectos para el programa
      setCurrentAppState(handlerInput, APP_STATES.PROJECTS_LISTING);
    }
    return handlerInput.responseBuilder
      .speak(intentOutput)
      .reprompt(intentOutput)
      .getResponse();
  }
};

/**
 * Manejador de intent para cuando se quiere inscribir a un programa
 */
const ProgramInscriptionIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    const currentState = getCurrentAppState(handlerInput);
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "programaInscripcion" &&
      (currentState === APP_STATES.PROGRAMS_QUERY_START ||
        currentState === APP_STATES.PROGRAM_INTEREST_QUERY ||
        currentState === APP_STATES.SINGLE_PROGRAM_QUERY ||
        currentState === APP_STATES.PROGRAM_TO_PROJECT_SWITCH)
    );
  },
  handle(handlerInput) {
    const program = getCurrentProgramState(handlerInput);
    const speakOutput = `Para inscribirte ${
      program ? "al programa " + program : "a un programa"
    }, \
    necesitas mandar una carta motivos y \
    una descripción de tu idea de negocio al correo silvia.salazarr@tec.mx. \
    ¿Hay algo más en lo que pueda ayudarte?`;

    setCurrentAppState(handlerInput, APP_STATES.PROGRAM_INTEREST_QUERY);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

/**
 * Manejador de intent para cuando se quiere saber de los proyectos
 */
const ProyectosEntryIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "proyectosEntry"
    );
  },
  async handle(handlerInput) {
    setCurrentAppState(handlerInput, APP_STATES.PROJECT_START);

    /// Que va a deicr alexa para introducir proyectos
    const speakOutput = `Los proyectos inscritos en programas de emprendimiento se dividen por 3 etapas \
    de negocio: Validación. desarrollo. y crecimiento. \
    ¿Qué tipo de proyectos te gustaría conocer?`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

/**
 * Manejador de intent para cuando se quiere saber de un proyecto en especifico
 */
const ProyectoInfoIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    const currentState = getCurrentAppState(handlerInput);
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "proyectoInfo" &&
      (currentState === APP_STATES.SINGLE_PROJECT_QUERY ||
        currentState === APP_STATES.PROJECTS_LISTING ||
        currentState === APP_STATES.PROJECT_START)
    );
  },
  async handle(handlerInput) {
    setCurrentAppState(handlerInput, APP_STATES.SINGLE_PROJECT_QUERY);

    // tomar el slot
    const proyecto = getSlot(handlerInput.requestEnvelope, "proyecto");
    // conseguir el nombre del slot
    const name =
      proyecto.resolutions?.resolutionsPerAuthority?.[0].values[0].value.name;

    // guardar el nombre del proyecto
    setCurrentProject(handlerInput, String(name));

    let speakOutput = "";

    // sacar datos del proyecto de la base de datos
    // el formato es { name,description,currentStage }
    const data = await fetch(`${APILink}/project/name?name=${name}`);
    const proyectoData = await data.json();

    speakOutput += `${proyectoData.name} es un proyecto enfocado a ${proyectoData.description}. \
    ¿Te interesa hacer contacto con ellos?`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

/**
 * Manejador de intent que administra cuando se necesita una respuesta a si o no
 */
const CallbackIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    const currentState = getCurrentAppState(handlerInput);
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "Callback" &&
      (currentState === APP_STATES.PROGRAM_INTEREST_QUERY ||
        currentState === APP_STATES.SINGLE_PROJECT_QUERY ||
        currentState === APP_STATES.SINGLE_PROJECT_QUERY_ENDED)
    );
  },
  handle(handlerInput) {
    const currentState = getCurrentAppState(handlerInput);
    const prevAnswer = getSlot(handlerInput.requestEnvelope, "sino");

    let speakOutput = "";
    let shouldSessionEnd = false;
    // const response = handlerInput.responseBuilder;

    switch (currentState) {
      // cuando se le pregunta al usuario si quiere hacer otra cosa al final de la interaccion o si ya es todo
      case APP_STATES.PROGRAM_INTEREST_QUERY:
      case APP_STATES.SINGLE_PROJECT_QUERY_ENDED:
        if (prevAnswer.value?.toLowerCase() === "si") {
          setCurrentAppState(handlerInput, APP_STATES.PROGRAMS_QUERY_START);
          speakOutput = "Perfecto, ¿Qué deseas saber?";
        } else {
          setCurrentAppState(handlerInput, APP_STATES.START);
          speakOutput = `Adios. Ojalá te haya sido de ayuda`;
          shouldSessionEnd = true;
        }
        break;
      // cuando se le dijo la informacion de un proyecto y se le pregutna al usuario si quiere contactar a los miembros del proyecto
      case APP_STATES.SINGLE_PROJECT_QUERY:
        if (prevAnswer.value?.toLowerCase() === "si") {
          const prevSessionProject = handlerInput.attributesManager.getSessionAttributes()
            .proyecto;
          speakOutput = `Puedes encontrar al equipo de ${prevSessionProject} en nuestras sesiones \
          mensuales de networking o contactarlos en el correo de contacto@${prevSessionProject}.com. \ 
          ¿Hay algo más en lo que pueda ayudarte? `;
          setCurrentAppState(
            handlerInput,
            APP_STATES.SINGLE_PROJECT_QUERY_ENDED
          );
        } else {
          setCurrentAppState(handlerInput, APP_STATES.START);
          speakOutput = `Muchas gracias por visitar la Zona Ei ¡Regresa pronto!`;
          shouldSessionEnd = true;
        }
        break;
      default:
        break;
    }

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .withShouldEndSession(shouldSessionEnd)
      .getResponse();
  }
};

/**
 * Manejador de intent para cuando el usuario pide ayuda
 */
const HelpIntentHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const currentAppState = getCurrentAppState(handlerInput);
    let intentOutput = "";
    switch (currentAppState) {
      case APP_STATES.PROGRAMS_QUERY_START:
        intentOutput +=
          "Puedes preguntarme acerca de todos los programas que tenemos. ";
        intentOutput +=
          "También puedo decirte como puedes involucrarte con nosotros. ";
        intentOutput +=
          "O puedo decirte acerca de los proyectos en los cuales se están trabajando actualmente. ";
        break;
      case APP_STATES.SINGLE_PROGRAM_QUERY:
        intentOutput +=
          "Puedes preguntarme de los proyectos a los cuales puedes inscribirte. ";
        intentOutput +=
          "También puedo decirte como puedes involucrarte con nosotros. ";
        break;
      case APP_STATES.PROGRAM_INTEREST_QUERY:
        intentOutput +=
          "Puedes preguntar acerca de los demás programas que tenemos. ";
        intentOutput +=
          "También puedes preguntarme acerca de los grupos que actualmente están en desarrollo";
        break;
      case APP_STATES.START:
        intentOutput +=
          "Te puedo dar información acerca de los programas que soportamos. ";
        intentOutput +=
          "Y te puedo dar información acerca de los proyectos actualmente en desarrollo";
        break;
      default:
        break;
    }
    /// const intentOutput = `Si quieres información acerca de los programas dime 'programas', si quieres información de los grupos dime 'grupos'`;
    return handlerInput.responseBuilder
      .speak(intentOutput)
      .reprompt(intentOutput)
      .getResponse();
  }
};

const RepeatIntentHandler: RequestHandler = {
  canHandle(inputHandler) {
    const currentState = getCurrentAppState(inputHandler);
    return (
      getRequestType(inputHandler.requestEnvelope) === "IntentRequest" &&
      getIntentName(inputHandler.requestEnvelope) === "AMAZON.RepeatIntent" &&
      currentState == APP_STATES.SINGLE_PROJECT_QUERY_ENDED
    );
  },
  async handle(inputHandler) {
    const { proyecto } = inputHandler.attributesManager.getSessionAttributes();
    let speakOutput = "";

    const data = await fetch(`${APILink}/project/name?name=${proyecto}`);

    const proyectoData = await data.json();
    /* 
      {
        name,
        description,
        currentStage
      }
   */
    speakOutput += `${proyectoData.name} es un proyecto enfocado a ${proyectoData.description}. \
    ¿Te interesa hacer contacto con ellos?`;

    return inputHandler.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(handleInput) {
    return (
      getRequestType(handleInput.requestEnvelope) === "IntentRequest" &&
      (getIntentName(handleInput.requestEnvelope) === "AMAZON.CancelIntent" ||
        getIntentName(handleInput.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  handle(handleInput) {
    const responseOutput = `Adios. Ojalá te haya sido de ayuda`;
    return handleInput.responseBuilder
      .speak(responseOutput)
      .reprompt(responseOutput)
      .getResponse();
  }
};

const SessionEndedRequestHandler: RequestHandler = {
  canHandle(handlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    setCurrentAppState(handlerInput, APP_STATES.START);
    const responseOutput = `Adios. Ojalá te haya sido de ayuda`;
    return handlerInput.responseBuilder.speak(responseOutput).getResponse();
  }
};

const IntentReflectorHandler: RequestHandler = {
  canHandle(handlerInput: HandlerInput) {
    return (
      getRequestType(handlerInput.requestEnvelope) === "IntentRequestHandler"
    );
  },
  handle(handlerInput: HandlerInput) {
    const intentName = getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `You just triggered ${intentName}`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const ErrorHandler: ErrorHandler = {
  canHandle(_) {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`~~~ Error handled: ${error.stack}`);
    const speakOutput = `Perdón no pude hacer lo que me pediste, intentalo de nuevo`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

function skillBuilder() {
  return SkillBuilders.custom()
    .addRequestHandlers(
      LaunchRequestHandler,
      InformationSwitchHandler,
      ProyectosEntryIntentHandler,
      ProyectoInfoIntentHandler,
      ProgramasEntryIntentHandler,
      InformationIntentHandler,
      ProgramInscriptionIntentHandler,
      RepeatIntentHandler,
      HelpIntentHandler,
      CancelAndStopIntentHandler,
      SessionEndedRequestHandler,
      CallbackIntentHandler,
      IntentReflectorHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();
}

export let handler = skillBuilder();
