import knex from "../knex";

interface DailyVisit {
  link_id: number;
  date: Date;
  visit_count: number;
}

interface LinkData {
  id: number; // Assuming id is of type number
  // Add other properties from Link if needed
}

export const insertDailyVisit = async (data: LinkData) => {
  const currentDate = new Date();
  console.log("incrementing Daily Visit");
  const dailyVisit: DailyVisit = {
    link_id: data.id, // Extracting link_id from the data object
    date: currentDate,
    visit_count: 1,
  };

  // Insert a new row into the 'dailyVisit' table with link_id, current date, and visit_count of 1
  await knex<DailyVisit>("daily_visit")
    .insert(dailyVisit)
    .onConflict(["link_id", "date"]) // Specify the unique constraint columns
    .merge({ visit_count: knex.raw("daily_visit.visit_count + 1") }); // Increment visit_count on conflict
};