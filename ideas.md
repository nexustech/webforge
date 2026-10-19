
# Webforge Research
Webforge is a proposed web development tool aimed at simplifying the process of building responsive websites.
The goal of Webforge is to provide an intuitive and efficient environment for web developers to create responsive websites with minimal effort.
The primary CSS library that we should support is Tailwind CSS. It is a utility-first CSS framework that allows developers to rapidly build custom designs without writing extensive custom CSS.
It is widely used, quite popular and would be a good way to build responsive and modern web interfaces efficiently.
Webforge should aim to integrate Tailwind CSS seamlessly, providing developers with a smooth and efficient workflow for building responsive web interfaces.
Before implementing webforge we need to do some research on how this could be implemented, including studying existing tools like Bootstrap Studio and understanding their architecture and workflow.

Key requirements
- Application should be cross platform, supporting Windows and MacOS, Linux is not a priority.
- Ability to install and upgrade webforge easily, preferably through an automated installer.
- Application should be easy to use, have a drag and drop interface with live preview
- Users will be primarily non-technical individuals who may not have extensive coding experience. There should not be an expectation that they know how web development works.
- There should be some CMS functionality, e.g. users should be able to click and update text directly on the page.

Key questions to research:
- How does Bootstrap Studio work internally?
- Is it an Electron application?
- How does it manage and store project files and configurations?
- What is the technology stack used by Bootstrap Studio?

For the proposed Webforge application we need to figure out
- Appropriate technology stack for Webforge.
- Appropriate project structure and file management for Webforge.
- Appropriate terminology for users, e.g. Pages, Components, Templates
- How we can enable live preview for Webforge projects.
- How we can package and deploy websites, these websites are likely to be static HTML, CSS, and JavaScript files. They should not have a dependency on a server-side runtime, e.g. Node.js so should compile to static assets.
- How to integrate Node.js or any required framework for generating and managing static assets.
- Application should be cross platform, supporting Windows and MacOS, Linux is not a priority
- Ability to install and upgrade webforge easily, preferably through an automated installer.

## Bootstrap Studio Overview
Bootstrap Studio is a visual designer for creating responsive websites using the Bootstrap framework.
It allows users to drag and drop components to build web pages, and it generates clean HTML, CSS, and JavaScript code automatically.
It is particularly useful for designers and developers who want to quickly prototype and build responsive websites without manually writing extensive code.
It also provides a wide range of pre-designed components and templates, making it easier to create professional-looking websites quickly.
Additionally, it supports real-time preview, allowing users to see changes instantly as they design their websites.
It also includes powerful tools for managing CSS, JavaScript, and other assets, making it easier to maintain and update websites efficiently.
Furthermore, it supports integration with popular version control systems, enabling collaborative development and efficient project management.
It also offers extensive documentation and community support, helping users to quickly find solutions and best practices for their web development projects.

## Goals
- Quickly prototype and build responsive websites without extensive manual coding.
- Utilize pre-designed components and templates to create professional-looking websites efficiently.
- Manage CSS, JavaScript, and other assets effectively for easier maintenance and updates.
- Collaborate with team members using version control system integration.
- Access extensive documentation and community support for problem-solving and best practices.

## Research questions
How does Bootstrap Studio work? Is it an Electron application? 

Two directories I have found on my computer
- C:\Program Files\Bootstrap Studio
- C:\Users\jabz_\AppData\Roaming\Bootstrap Studio
Read these directories to understand where Bootstrap Studio stores its files and configurations. Try to decipher the technology stack that is used

