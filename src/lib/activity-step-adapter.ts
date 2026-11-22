import { activityModelFromSpec, activityModelToSpec, type ActivityModel } from "@/lib/activity-model";
import type { ActivityStep, StepSettings } from "@/lib/studio-step";

/** Studio krok → kanonický model. Původní krok zůstává u rodiče pro bezeztrátový zpětný zápis. */
export function activityModelFromStep(step: ActivityStep): ActivityModel {
  const model = activityModelFromSpec({
    ...step.content,
    activityType: step.type === "exit" ? "wall" : step.type,
    title: step.title,
    question: step.title,
    timeLimitSec: step.settings.timeLimitSec,
    points: step.settings.points,
    imageUrl: step.imageUrl,
    explanation: step.explanation,
  }, step.settings.individual ? "individual" : "inherit");
  model.settings = {
    ...model.settings,
    liveMode: step.settings.liveMode,
    showSolution: step.settings.showSolution,
    timeAuto: step.settings.timeAuto,
  };
  if (step.type === "mcq") {
    model.options = (step.content.options ?? []).map((value: any) => ({ text: String(value ?? "") }));
    model.correctIndex = Number(step.content.correctIndex) || 0;
  }
  return model;
}

function settingsFromModel(model: ActivityModel, previous: StepSettings): StepSettings {
  return {
    ...previous,
    timeLimitSec: model.settings.timeLimitSec,
    points: model.settings.points,
    individual: model.settings.participation === "individual",
    ...(model.settings.liveMode !== undefined ? { liveMode: model.settings.liveMode } : {}),
    ...(model.settings.showSolution !== undefined ? { showSolution: model.settings.showSolution } : {}),
    ...(model.settings.timeAuto !== undefined ? { timeAuto: model.settings.timeAuto } : {}),
  };
}

/** Model → původní Studio krok. ID, AI metadata, _extra a neznámý obsah se zachovají. */
export function activityModelToStep(model: ActivityModel, previous: ActivityStep): ActivityStep {
  if (previous.type === "mcq") {
    return {
      ...previous,
      title: model.question || model.title,
      content: {
        ...previous.content,
        ...model.content,
        options: model.options.map((option) => option.text),
        correctIndex: model.correctIndex,
      },
      settings: settingsFromModel(model, previous.settings),
      _extra: model.settings.timeLimitSec !== previous.settings.timeLimitSec ? { ...previous._extra, blockTimeExplicit: true } : previous._extra,
      explanation: model.explanation,
      imageUrl: model.imageUrl,
    };
  }
  const spec = activityModelToSpec(model, {
    ...previous.content,
    activityType: previous.type === "exit" ? "wall" : previous.type,
    question: previous.title,
    timeLimitSec: previous.settings.timeLimitSec,
    points: previous.settings.points,
    imageUrl: previous.imageUrl,
    explanation: previous.explanation,
  });
  const {
    activityType: _activityType, title: _title, question: _question,
    timeLimitSec: _timeLimitSec, points: _points, imageUrl: _imageUrl,
    explanation: _explanation, soloRound: _soloRound, showSolution: _showSolution, timeAuto: _timeAuto,
    ...content
  } = spec;
  return {
    ...previous,
    title: model.question || model.title,
    content,
    settings: settingsFromModel(model, previous.settings),
    explanation: model.explanation,
    imageUrl: model.imageUrl,
  };
}
