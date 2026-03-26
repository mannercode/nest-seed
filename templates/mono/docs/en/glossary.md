> **English** | [한국어](../ko/glossary.md)

# Domain Glossary

Defines the key terms used in the movie ticketing domain.

| Term              | English          | Description                                                                                                                                         |
| ----------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer          | Customer         | A service user. After signing up, they can search for movies and purchase tickets.                                                                  |
| Movie             | Movie            | Screenable content. Has information such as rating, genre, and duration. Must be in published state to register showtimes.                          |
| Theater           | Theater          | A physical venue where movies are screened. Includes location coordinates and a seatmap.                                                            |
| Seatmap           | Seatmap          | The seating structure of a theater. Organized in a hierarchy of block > row > seat.                                                                 |
| Showdate          | Showdate         | A date on which a specific movie is screened at a specific theater. Extracted from the date portion of a Showtime.                                  |
| Showtime          | Showtime         | A time slot for screening a specific movie at a specific theater. Defined by start time and end time.                                               |
| Ticket            | Ticket           | A booking unit for one seat in one showtime. Has either `available` or `sold` status.                                                               |
| Ticket Holding    | TicketHolding    | Temporarily reserving a ticket before purchase. Held for 10 minutes; automatically released on timeout.                                             |
| Purchase Record   | PurchaseRecord   | A completed purchase transaction. Includes purchase items (tickets, food & beverage, etc.) and payment information.                                 |
| Watch Record      | WatchRecord      | A record of a customer watching a movie. Used as input data for the recommendation system.                                                          |
| Payment           | Payment          | Payment processing for a purchase. Abstracts integration with external payment systems.                                                             |
| Asset             | Asset            | An uploaded file (e.g., poster images). Uploaded/downloaded via presigned URLs.                                                                     |
| Showtime Creation | ShowtimeCreation | An async job that creates showtimes and tickets at once from a combination of movie, theaters, and times.                                           |
| Booking           | Booking          | The process of a customer browsing theaters, showtimes, and seats, then holding tickets.                                                            |
| Purchase          | Purchase         | The process of proceeding with payment for held tickets and confirming the purchase.                                                                |
| Recommendation    | Recommendation   | A feature that recommends movies based on the customer's watch history and currently showing movies. Sorted by genre match and latest release date. |
| Rating            | MovieRating      | Movie viewing rating. One of `G`, `PG`, `PG13`, `R`, `NC17`, `Unrated`.                                                                             |
| Genre             | MovieGenre       | Movie genre. `action`, `comedy`, `drama`, `fantasy`, `horror`, `mystery`, `romance`, `thriller`, `western`.                                         |

---

## General Terms

Defines the distinction criteria for general terms used in code, separate from domain terms.

### Process / Task / Job

| Name        | Meaning                                           | Scope / Duration         | Example                                         |
| ----------- | ------------------------------------------------- | ------------------------ | ----------------------------------------------- |
| **Process** | A business flow with multiple stages              | Long, multiple stages    | "Movie registration process", "Booking process" |
| **Task**    | A single small unit of work within a process      | Short, relatively atomic | "Upload poster image", "Validate showtime"      |
| **Job**     | A background task, work item queued for execution | Async / batch            | "Run nightly settlement job", "Send email job"  |

### Complete / Finish

| Name         | Meaning                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| **complete** | To fulfill all requirements and bring to completion. Also suitable as a status value (`status: "COMPLETED"`) |
| **finish**   | To simply end. Implies termination regardless of success or failure                                          |
