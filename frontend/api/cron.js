export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://exclusive-johnette-davidoh-525a86c7.koyeb.app/api/v1/healthcheck",
      {
        method: "GET",
      }
    );

    if (response.ok) {
      res.status(200).json({ status: "success", message: "Healthcheck pinged successfully" });
    } else {
      res.status(response.status).json({ status: "error", message: "Healthcheck failed" });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
}
