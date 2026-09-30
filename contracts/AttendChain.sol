// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AttendChain
 * @notice Blockchain-based anti-proxy attendance system.
 *
 * THE PROBLEM
 * -----------
 * In classrooms and workplaces, "proxy attendance" is rampant: a student marks
 * a present for an absent friend, or paper/registers are edited after the fact.
 * Central databases can be silently altered by whoever controls them.
 *
 * THE BLOCKCHAIN SOLUTION
 * -----------------------
 * 1. IDENTITY  - Each person marks attendance from THEIR OWN wallet. Because a
 *                transaction must be signed by the sender's private key, you
 *                cannot mark attendance "as" someone else without their key.
 *                This kills proxy attendance.
 * 2. NO DOUBLES- The contract records one mark per student per session.
 * 3. IMMUTABLE - Once written on-chain, a record cannot be edited or deleted,
 *                not even by the teacher or admin. It is tamper-proof.
 * 4. TIME-BOUND- A student can only mark while the teacher has the session OPEN,
 *                so nobody can back-date attendance.
 * 5. TRANSPARENT- Anyone can independently verify who attended each session.
 */
contract AttendChain {
    // ----------------------------------------------------------------- Roles
    address public immutable admin; // whoever deployed the contract

    mapping(address => bool) public isTeacher;

    struct Student {
        string name;
        string rollNo;
        bool registered;
    }
    mapping(address => Student) public students;
    address[] private studentAddresses;

    // --------------------------------------------------------------- Sessions
    struct Session {
        uint256 id;
        string courseName;
        address teacher;
        uint256 openedAt;
        bool open;
        uint256 attendeeCount;
    }
    Session[] private sessions;

    // sessionId => (student => hasMarked)
    mapping(uint256 => mapping(address => bool)) public marked;
    // sessionId => marked timestamp (0 if not marked)
    mapping(uint256 => mapping(address => uint256)) public markedAt;
    // sessionId => list of attendee addresses (for easy enumeration)
    mapping(uint256 => address[]) private attendees;

    // ----------------------------------------------------------------- Events
    event TeacherAdded(address indexed teacher);
    event StudentRegistered(address indexed student, string name, string rollNo);
    event SessionCreated(uint256 indexed sessionId, string courseName, address indexed teacher);
    event SessionClosed(uint256 indexed sessionId);
    event AttendanceMarked(uint256 indexed sessionId, address indexed student, uint256 timestamp);

    // -------------------------------------------------------------- Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    modifier onlyTeacher() {
        require(isTeacher[msg.sender], "Only a teacher");
        _;
    }

    constructor() {
        admin = msg.sender;
        // Deployer is also a teacher by default so a single account can demo end-to-end.
        isTeacher[msg.sender] = true;
        emit TeacherAdded(msg.sender);
    }

    // -------------------------------------------------------- Admin functions
    /// @notice Grant the teacher role to an address.
    function addTeacher(address teacher) external onlyAdmin {
        require(teacher != address(0), "Zero address");
        require(!isTeacher[teacher], "Already a teacher");
        isTeacher[teacher] = true;
        emit TeacherAdded(teacher);
    }

    /// @notice Register a student's wallet with their real-world identity.
    function registerStudent(
        address student,
        string calldata name,
        string calldata rollNo
    ) external onlyAdmin {
        require(student != address(0), "Zero address");
        require(!students[student].registered, "Already registered");
        students[student] = Student({name: name, rollNo: rollNo, registered: true});
        studentAddresses.push(student);
        emit StudentRegistered(student, name, rollNo);
    }

    // ------------------------------------------------------ Teacher functions
    /// @notice Open a new attendance session for a course.
    function createSession(string calldata courseName) external onlyTeacher returns (uint256) {
        uint256 id = sessions.length;
        sessions.push(
            Session({
                id: id,
                courseName: courseName,
                teacher: msg.sender,
                openedAt: block.timestamp,
                open: true,
                attendeeCount: 0
            })
        );
        emit SessionCreated(id, courseName, msg.sender);
        return id;
    }

    /// @notice Close a session so no more attendance can be marked.
    /// @dev Only the teacher who created it, or the admin, can close it.
    function closeSession(uint256 sessionId) external {
        require(sessionId < sessions.length, "No such session");
        Session storage s = sessions[sessionId];
        require(msg.sender == s.teacher || msg.sender == admin, "Not authorized");
        require(s.open, "Already closed");
        s.open = false;
        emit SessionClosed(sessionId);
    }

    // ------------------------------------------------------ Student functions
    /**
     * @notice Mark YOUR OWN attendance for an open session.
     * @dev The caller (msg.sender) is the attendee. There is no way to pass in
     *      someone else's address, which is exactly what prevents proxy attendance.
     */
    function markAttendance(uint256 sessionId) external {
        require(sessionId < sessions.length, "No such session");
        require(students[msg.sender].registered, "Not a registered student");
        Session storage s = sessions[sessionId];
        require(s.open, "Session is closed");
        require(!marked[sessionId][msg.sender], "Already marked");

        marked[sessionId][msg.sender] = true;
        markedAt[sessionId][msg.sender] = block.timestamp;
        attendees[sessionId].push(msg.sender);
        s.attendeeCount += 1;

        emit AttendanceMarked(sessionId, msg.sender, block.timestamp);
    }

    // ------------------------------------------------------------- View calls
    function sessionCount() external view returns (uint256) {
        return sessions.length;
    }

    function getSession(uint256 sessionId)
        external
        view
        returns (
            uint256 id,
            string memory courseName,
            address teacher,
            uint256 openedAt,
            bool open,
            uint256 attendeeCount
        )
    {
        require(sessionId < sessions.length, "No such session");
        Session storage s = sessions[sessionId];
        return (s.id, s.courseName, s.teacher, s.openedAt, s.open, s.attendeeCount);
    }

    /// @notice Was a given student present at a given session?
    function isPresent(uint256 sessionId, address student) external view returns (bool) {
        return marked[sessionId][student];
    }

    /// @notice Full list of attendee addresses for a session.
    function getAttendees(uint256 sessionId) external view returns (address[] memory) {
        require(sessionId < sessions.length, "No such session");
        return attendees[sessionId];
    }

    function studentCount() external view returns (uint256) {
        return studentAddresses.length;
    }

    function getStudentAddresses() external view returns (address[] memory) {
        return studentAddresses;
    }
}
