/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `SurveyLead` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SurveyLead_email_key" ON "SurveyLead"("email");
