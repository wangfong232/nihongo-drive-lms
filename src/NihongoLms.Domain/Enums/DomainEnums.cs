namespace NihongoLms.Domain.Enums;

public enum NodeType
{
    Folder = 0,
    File = 1
}

public enum ResourceType
{
    PrimaryVideo = 0,
    Audio = 1,
    ExercisePdf = 2,
    Document = 3,
    Image = 4,
    Other = 5
}

public enum SrsState
{
    New = 0,
    Learning = 1,
    Review = 2,
    Relearning = 3
}

public enum QuizType
{
    LessonQuiz = 0,
    GlobalReviewQuiz = 1,
    PracticeTest = 2
}

public enum QuestionType
{
    MultipleChoice = 0,
    MultipleSelect = 1,
    FillInTheBlank = 2,
    DragAndDrop = 3,
    Matching = 4,
    TrueFalse = 5,
    ListeningComprehension = 6,
    FreeResponse = 7
}
