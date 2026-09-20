export function workerDomain(value) {
  const domain = String(value).toLowerCase();
  const labels = domain.split(".");
  if (domain.length > 253 || labels.length < 2
      || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
      || !/^[a-z]{2,63}$/.test(labels.at(-1))
      || /\.(local|localhost|internal|test|invalid|example)$/.test(domain)) {
    throw new Error("Supply a full public hostname you control, such as worker.yourdomain.com (no URL, path, or port).");
  }
  return domain;
}

export function deploymentEnvironment(domain, key) {
  const url = `https://${workerDomain(domain)}`;
  // Launcher-generated keys are hex; reject multiline or shell/env interpolation.
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid saved worker key; expected the setup-generated secret.");
  return `EXPERIMENT_API_URL=${url}\nEXPERIMENT_API_KEY=${key}\nLEAN_API_URL=${url}\nLEAN_API_KEY=${key}\n`;
}
